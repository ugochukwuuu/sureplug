import crypto from 'crypto';

const KORA_SECRET_KEY = process.env.KORA_SECRET_KEY;
const KORA_MERCHANT_ID = process.env.KORA_MERCHANT_ID;
const BASE_URL = 'https://api.korapay.com';

/**
 * Helper to execute node-fetch requests with headers
 */
async function fetchWithRetry(url, options, retries = 3, backoff = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
    } catch (err) {
      if (i === retries - 1) throw err;
    }
    await new Promise((res) => setTimeout(res, backoff * Math.pow(2, i)));
  }
  throw new Error(`Request to ${url} failed after ${retries} retries.`);
}

/**
 * Initialize a charge session with Kora Pay
 */
export async function initializeCharge({ reference, amountKobo, currency, customer, redirectUrl, correlationId }) {
  if (process.env.NODE_ENV === 'test' || !KORA_SECRET_KEY || KORA_SECRET_KEY.includes('your_kora_secret_key')) {
    console.log(`[Test Mode] Mocking Kora charge initialization for ref: ${reference}`);
    return {
      checkoutUrl: `${redirectUrl}${reference}`
    };
  }

  if (!KORA_SECRET_KEY) {
    throw new Error('FATAL: KORA_SECRET_KEY is not defined in the environment.');
  }

  // Convert amount from kobo to standard units (Naira) for Kora Pay
  const amount = Number((amountKobo / 100).toFixed(2));

  console.log(`[TraceID: ${correlationId}] Initializing Kora charge. Reference: ${reference}, Amount: ${amount} ${currency}`);

  const payload = {
    amount,
    reference,
    currency,
    redirect_url: redirectUrl,
    customer: {
      name: customer.name,
      email: customer.email
    }
  };

  const response = await fetchWithRetry(`${BASE_URL}/merchant/api/v1/charges/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KORA_SECRET_KEY}`,
      'X-Correlation-ID': correlationId
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();

  if (!response.ok || !body.status) {
    console.error(`[TraceID: ${correlationId}] Kora charge init failed:`, body);
    const err = new Error(body.message || 'Failed to initialize Kora charge.');
    err.statusCode = response.status;
    err.responseBody = body;
    throw err;
  }

  return {
    checkoutUrl: body.data.checkout_url
  };
}

/**
 * Verify a transaction using Kora's verification endpoint
 */
export async function verifyCharge({ reference, correlationId }) {
  if (process.env.NODE_ENV === 'test' || !KORA_SECRET_KEY || KORA_SECRET_KEY.includes('your_kora_secret_key')) {
    try {
      const { dbGet } = await import('../db/db.js');
      const order = await dbGet('SELECT total_amount_kobo FROM orders WHERE payment_reference = ?', [reference]);
      const amountKobo = order ? order.total_amount_kobo : 10000;
      
      console.log(`[Test Mode] Mocking Kora verification payload for reference: ${reference}, Amount: ${amountKobo} kobo`);
      return {
        success: true,
        status: 'paid',
        reference: reference,
        amountKobo: amountKobo,
        currency: process.env.DEFAULT_CURRENCY || 'NGN',
        transactionId: `mock_tx_${Date.now()}`,
        paymentMethod: 'card',
        paidAt: new Date().toISOString(),
        responseCode: '00',
        rawPayload: { mock: true }
      };
    } catch (e) {
      console.error('[Test Mode] Mock verification query failed:', e);
    }
  }

  if (!KORA_SECRET_KEY) {
    throw new Error('FATAL: KORA_SECRET_KEY is not defined in the environment.');
  }

  console.log(`[TraceID: ${correlationId}] Querying Kora verification for reference: ${reference}`);

  const response = await fetchWithRetry(`${BASE_URL}/merchant/api/v1/charges/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KORA_SECRET_KEY}`,
      'X-Correlation-ID': correlationId
    }
  });

  const body = await response.json();

  if (!response.ok || !body.status) {
    console.error(`[TraceID: ${correlationId}] Kora verify failed:`, body);
    return {
      success: false,
      message: body.message || 'Kora transaction verification request failed.'
    };
  }

  const tx = body.data;

  // Convert standard units (Naira) returned by Kora back to integer kobo
  const amountKobo = Math.round(tx.amount * 100);

  // Map Kora statuses ('success', 'failed', 'processing', etc.) to standard states
  let mappedStatus = 'pending';
  if (tx.status === 'success') mappedStatus = 'paid';
  else if (tx.status === 'failed') mappedStatus = 'failed';
  else if (tx.status === 'expired') mappedStatus = 'expired';

  // Sanitize raw payload (remove sensitive keys if any exist)
  const sanitizedPayload = { ...tx };
  delete sanitizedPayload.secret_key;

  // Verify credited merchant ID matches config if config exists
  if (KORA_MERCHANT_ID && tx.merchant_id && String(tx.merchant_id) !== String(KORA_MERCHANT_ID)) {
    console.warn(`[TraceID: ${correlationId}] Merchant ID mismatch! Config: ${KORA_MERCHANT_ID}, Response: ${tx.merchant_id}`);
    return {
      success: false,
      message: 'Transaction credited to an unauthorized merchant account.'
    };
  }

  return {
    success: true,
    status: mappedStatus,
    reference: tx.reference,
    amountKobo,
    currency: tx.currency,
    transactionId: tx.transaction_id || tx.id,
    paymentMethod: tx.payment_method,
    paidAt: tx.paid_at || new Date().toISOString(),
    responseCode: tx.response_code || '00',
    rawPayload: sanitizedPayload
  };
}

/**
 * Validate webhook signature
 */
export function validateWebhook({ headers, rawBody }) {
  if (!KORA_SECRET_KEY) {
    return false;
  }

  const signature = headers['x-korapay-signature'];
  if (!signature) {
    return false;
  }

  const calculated = crypto
    .createHmac('sha256', KORA_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    return false;
  }
}
