import crypto from 'crypto';
import { getProvider } from './index.js';
import { dbRun, dbGet } from '../db/db.js';
import { sendOrderConfirmationEmail } from '../services/email.js';

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

/**
 * Initialize a checkout payment session
 */
export async function initializePayment({ orderId, paymentReference, amountKobo, customer, redirectUrl, correlationId }) {
  console.log(`[TraceID: ${correlationId}] PaymentService: Initializing payment for order ${orderId}`);
  
  const ref = paymentReference || crypto.randomUUID();
  const provider = getProvider();
  
  // Call provider-specific charge setup
  const { checkoutUrl } = await provider.initializeCharge({
    reference: ref,
    amountKobo,
    currency: DEFAULT_CURRENCY,
    customer,
    redirectUrl,
    correlationId
  });

  // Save the reference and checkout link to the order
  await dbRun(
    `UPDATE orders 
     SET payment_reference = ?, checkout_url = ?, provider_name = ? 
     WHERE id = ?`,
    [ref, checkoutUrl, process.env.PAYMENT_PROVIDER || 'kora', orderId]
  );

  return { checkoutUrl, paymentReference: ref };
}

/**
 * Validate and process an incoming webhook payload
 */
export async function processWebhook({ headers, rawBody, correlationId }) {
  console.log(`[TraceID: ${correlationId}] PaymentService: Processing incoming webhook`);

  const provider = getProvider();
  
  // 1. Verify Signature
  const isValid = provider.validateWebhook({ headers, rawBody });
  if (!isValid && process.env.NODE_ENV === 'production') {
    console.error(`[TraceID: ${correlationId}] Webhook signature validation failed.`);
    return { success: false, status: 401, error: 'Invalid webhook signature.' };
  }

  // 2. Compute SHA-256 event hash to block duplicates
  const eventHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  // 3. Parse payload JSON and extract reference
  let payloadObj;
  try {
    payloadObj = JSON.parse(rawBody.toString());
  } catch (err) {
    return { success: false, status: 400, error: 'Invalid JSON request payload.' };
  }

  const txData = payloadObj.data || {};
  const reference = txData.reference || payloadObj.reference;

  if (!reference) {
    return { success: false, status: 400, error: 'Missing transaction reference.' };
  }

  // 4. Sanitize payload and headers (redact keys/auth tokens)
  const sanitizedHeaders = { ...headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders['x-korapay-signature'];

  const sanitizedPayload = { ...payloadObj };

  // Log the event in payment_events audit table
  try {
    await dbRun(
      `INSERT INTO payment_events (payment_reference, event_hash, event_type, provider_status, headers, payload) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reference,
        eventHash,
        payloadObj.event || 'charge.completed',
        txData.status || payloadObj.status || 'unknown',
        JSON.stringify(sanitizedHeaders),
        JSON.stringify(sanitizedPayload)
      ]
    );
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      console.log(`[TraceID: ${correlationId}] Duplicate webhook event hash detected. Ignoring duplicate execution.`);
      return { success: true, status: 200, message: 'Duplicate event ignored.' };
    }
    console.error(`[TraceID: ${correlationId}] Failed to log payment event:`, err);
  }

  // 5. Trigger verify charge flow (Double Verification check)
  return await verifyPayment({ reference, correlationId });
}

/**
 * Double-verify payment status directly with the gateway and settle order status inside atomic transaction
 */
export async function verifyPayment({ reference, correlationId }) {
  console.log(`[TraceID: ${correlationId}] PaymentService: Running double-verification for: ${reference}`);

  const provider = getProvider();
  
  const startTime = Date.now();
  let verificationRes;
  try {
    verificationRes = await provider.verifyCharge({ reference, correlationId });
  } catch (err) {
    console.error(`[TraceID: ${correlationId}] Provider verification call failed:`, err);
    return { success: false, status: 502, error: 'Verification provider gateway request failed.' };
  }
  const latency = Date.now() - startTime;

  // Log verification event and update duration metric
  await dbRun(
    `INSERT INTO payment_events (payment_reference, event_hash, event_type, provider_status, headers, payload, verification_duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      reference,
      crypto.randomUUID(), // unique check bypass
      'verification_api_call',
      verificationRes.status || 'failed',
      '{}',
      JSON.stringify(verificationRes),
      latency
    ]
  ).catch(err => console.error('Failed to log verification query metric:', err));

  if (!verificationRes.success) {
    return { success: false, status: 400, error: verificationRes.message };
  }

  // BEGIN IMMEDIATE TRANSACTION for write-lock safety
  await dbRun('BEGIN IMMEDIATE');

  try {
    // 1. Retrieve current order record
    const order = await dbGet('SELECT * FROM orders WHERE payment_reference = ?', [reference]);
    if (!order) {
      console.error(`[TraceID: ${correlationId}] Order not found for reference: ${reference}`);
      await dbRun('ROLLBACK');
      return { success: false, status: 404, error: 'Associated order was not found.' };
    }

    // 2. Idempotency check: Already processed
    if (order.payment_status === 'paid') {
      console.log(`[TraceID: ${correlationId}] Order #${order.id} payment already processed. Settle skipped.`);
      await dbRun('COMMIT');
      return { success: true, status: 200, message: 'Payment already processed.' };
    }

    // 3. Strict alignment check: amount, currency, and provider success
    if (verificationRes.status !== 'paid') {
      console.warn(`[TraceID: ${correlationId}] Transaction verified but status is: ${verificationRes.status}`);
      await dbRun(
        `UPDATE orders 
         SET payment_status = ?, provider_transaction_id = ?, provider_payment_method = ?, provider_response_code = ?
         WHERE id = ?`,
        [verificationRes.status, verificationRes.transactionId, verificationRes.paymentMethod, verificationRes.responseCode, order.id]
      );
      await dbRun('COMMIT');
      return { success: false, status: 400, error: `Transaction payment state is '${verificationRes.status}'` };
    }

    if (verificationRes.currency !== DEFAULT_CURRENCY) {
      console.error(`[TraceID: ${correlationId}] Currency mismatch! Expected: ${DEFAULT_CURRENCY}, Paid: ${verificationRes.currency}`);
      await dbRun(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`, [order.id]);
      await dbRun('COMMIT');
      return { success: false, status: 400, error: 'Transaction currency mismatch.' };
    }

    if (Number(verificationRes.amountKobo) !== Number(order.total_amount_kobo)) {
      console.error(`[TraceID: ${correlationId}] Amount mismatch! Expected: ${order.total_amount_kobo} kobo, Paid: ${verificationRes.amountKobo} kobo`);
      await dbRun(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`, [order.id]);
      await dbRun('COMMIT');
      return { success: false, status: 400, error: 'Transaction payable amount mismatch.' };
    }

    // 4. Availability check
    const cartItems = JSON.parse(order.items_json);
    let isAllAvailable = true;

    for (const item of cartItems) {
      const prod = await dbGet('SELECT title, is_available FROM products WHERE id = ?', [item.id]);
      if (!prod || prod.is_available === 0) {
        isAllAvailable = false;
        console.warn(`[TraceID: ${correlationId}] Product availability check failed for "${prod?.title || item.title}" during settlement.`);
        break;
      }
    }

    if (isAllAvailable) {
      // Mark paid and unfulfilled -> pending
      await dbRun(
        `UPDATE orders 
         SET payment_status = 'paid', fulfillment_status = 'pending', provider_transaction_id = ?, provider_payment_method = ?, provider_paid_at = ?, provider_response_code = ?
         WHERE id = ?`,
        [verificationRes.transactionId, verificationRes.paymentMethod, verificationRes.paidAt, verificationRes.responseCode, order.id]
      );
      
      console.log(`[TraceID: ${correlationId}] Order #${order.id} payment verified successfully.`);
    } else {
      // Settle as payment received, but logistical fulfillment failed due to unavailability
      await dbRun(
        `UPDATE orders 
         SET payment_status = 'paid', fulfillment_status = 'fulfillment_failed', provider_transaction_id = ?, provider_payment_method = ?, provider_paid_at = ?, provider_response_code = ?
         WHERE id = ?`,
        [verificationRes.transactionId, verificationRes.paymentMethod, verificationRes.paidAt, verificationRes.responseCode, order.id]
      );
      
      console.error(`[TraceID: ${correlationId}] One or more items went unavailable before payment settled for Order #${order.id}. fulfillment_status set to FULFILLMENT_FAILED.`);
    }

    await dbRun('COMMIT');

    // Trigger order confirmation email in background (swallow failures so it doesn't block response)
    dbGet('SELECT * FROM orders WHERE id = ?', [order.id]).then(updatedOrder => {
      if (updatedOrder) {
        sendOrderConfirmationEmail(updatedOrder).catch(err => {
          console.error('[Payment Service] Failed to send order confirmation email:', err);
        });
      }
    }).catch(err => {
      console.error('[Payment Service] Failed to retrieve updated order for email confirmation:', err);
    });

    return { success: true, status: 200, message: 'Payment verified and settled.' };

  } catch (err) {
    console.error(`[TraceID: ${correlationId}] Failed to complete write transaction. Rolling back:`, err);
    await dbRun('ROLLBACK');
    throw err;
  }
}
