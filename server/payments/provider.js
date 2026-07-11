/**
 * Payment Provider Interface Documentation
 * 
 * Any payment provider module (e.g., kora.js, paystack.js) must implement and export
 * the following functions:
 * 
 * 1. initializeCharge({ reference, amountKobo, currency, customer, redirectUrl, correlationId })
 *    - reference: Unique payment reference string.
 *    - amountKobo: Total transaction amount in integer kobo.
 *    - currency: Currency code (e.g. 'NGN').
 *    - customer: Object with { name, email, phone }.
 *    - redirectUrl: Return redirect destination URL.
 *    - correlationId: Correlation ID for request tracing.
 *    - Returns: Promise resolving to `{ checkoutUrl }` or throws an Error.
 * 
 * 2. verifyCharge({ reference, correlationId })
 *    - reference: Unique payment reference string.
 *    - correlationId: Correlation ID for request tracing.
 *    - Returns: Promise resolving to an object with:
 *      {
 *        success: boolean,
 *        status: 'paid' | 'failed' | 'pending' | 'expired',
 *        reference: string,
 *        amountKobo: number,
 *        currency: string,
 *        transactionId: string,
 *        paymentMethod: string,
 *        paidAt: string (ISO Date),
 *        responseCode: string,
 *        rawPayload: object (sanitized)
 *      }
 * 
 * 3. validateWebhook({ headers, rawBody })
 *    - headers: Request headers object.
 *    - rawBody: Buffer of the raw HTTP request body.
 *    - Returns: boolean (true if valid signature, false otherwise).
 */
