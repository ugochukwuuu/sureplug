# SurePlug Environment Variables Configuration

This document lists all environment variables required for running the SurePlug application in both development and production (e.g. Railway) environments.

## Database Configuration

*   **`DATABASE_URL`** (Required)
    *   *Description*: The PostgreSQL connection string URL.
    *   *Example*: `postgresql://postgres:password@localhost:5432/sureplug` (Local)
    *   *Production (Railway)*: Provided automatically by Railway when provisioning a PostgreSQL database service.

## Core Server Settings

*   **`PORT`** (Optional, default: `3000`)
    *   *Description*: The port number the Express server will listen on.
    *   *Production (Railway)*: Provided automatically by Railway.

*   **`NODE_ENV`** (Optional, default: `development`)
    *   *Description*: The execution environment. Set to `production` in production.

## Admin Authentication

*   **`JWT_SECRET`** (Required)
    *   *Description*: The private secret key used to sign JWT session tokens for admin panel authentication.
    *   *Example*: A long cryptographically secure random string.

*   **`SUPER_ADMIN_EMAILS`** (Optional, default: `ugobright31@gmail.com`)
    *   *Description*: A comma-separated list of email addresses authorized to register as administrative accounts on startup.
    *   *Example*: `email1@example.com,email2@example.com`

## AI Recommendation Engine

*   **`GEMINI_API_KEY`** (Required)
    *   *Description*: API Key for Google Gemini services, used to drive AI product recommendations. Obtain from Google AI Studio.

## Email Notifications

*   **`RESEND_API_KEY`** (Required)
    *   *Description*: API key for Resend email provider to send customer receipt notifications.

*   **`RESEND_FROM_EMAIL`** (Optional, default: `SurePlug <onboarding@resend.dev>`)
    *   *Description*: Verified sender email address in Resend dashboard.

## Payment Gateway (Korapay)

*   **`PAYMENT_PROVIDER`** (Optional, default: `kora`)
    *   *Description*: The identifier for the payment provider.

*   **`DEFAULT_CURRENCY`** (Optional, default: `NGN`)
    *   *Description*: The default pricing/payable currency.

*   **`KORA_MERCHANT_ID`** (Required for Checkout)
    *   *Description*: Merchant ID in Korapay Merchant dashboard.

*   **`KORA_SECRET_KEY`** (Required for Checkout)
    *   *Description*: Secret API key for authenticating API charges and verifying webhooks.

*   **`KORA_PUBLIC_KEY`** (Required for Checkout)
    *   *Description*: Public API key for Korapay client configurations.

*   **`FRONTEND_URL`** (Optional, default: `http://localhost:5173`)
    *   *Description*: The base URL of the client application, used to direct redirect callbacks after payment checkout.

---

## Railway Setup Instructions

When deploying on Railway:
1. Provision a **PostgreSQL** service alongside your Web service.
2. In the Web service, navigate to **Variables** and add the following:
   - `DATABASE_URL` pointing to `${{Postgres.DATABASE_URL}}` (Railway will auto-resolve this value).
   - `JWT_SECRET` (generate a secure value).
   - `GEMINI_API_KEY` (copy from Google AI Studio).
   - `RESEND_API_KEY` (copy from Resend).
   - `KORA_SECRET_KEY` and other Korapay variables.
