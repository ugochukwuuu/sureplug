import { Resend } from 'resend';
import { getBrand } from './brandCache.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY && !RESEND_API_KEY.includes('your_resend_api_key_here') ? new Resend(RESEND_API_KEY) : null;

/**
 * Sends a transactional HTML order confirmation email to the customer using Resend.
 * @param {Object} order - The complete order details object from the database.
 */
export async function sendOrderConfirmationEmail(order) {
  if (!resend) {
    console.warn('[Email Service] Resend client not initialized. Check RESEND_API_KEY in .env. Skipping confirmation email.');
    return;
  }

  try {
    const brandData = await getBrand();
    const firstName = (order.customer_name || '').split(' ')[0] || 'Customer';
    const frontendUrl = brandData.website_url || 'http://localhost:5173';
    const trackingUrl = `${frontendUrl}/track/${order.payment_reference}`;
    
    // Parse order items
    let items = [];
    try {
      items = typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : order.items_json;
    } catch (e) {
      console.error('Error parsing items JSON for email:', e);
    }

    // Build summary rows with inline styling
    let itemsRows = '';
    let subtotal = 0;
    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      itemsRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: left; font-size: 14px; color: #334155;">${item.title}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 14px; color: #334155;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 14px; color: #334155;">₦${Number(item.price).toLocaleString('en-NG')}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 14px; color: #334155; font-weight: bold;">₦${Number(itemTotal).toLocaleString('en-NG')}</td>
        </tr>
      `;
    }

    // Build review request HTML buttons
    let reviewsHtml = '';
    for (const item of items) {
      const reviewUrl = `${frontendUrl}/review?ref=${order.payment_reference}&product=${item.id}`;
      reviewsHtml += `
        <div style="margin: 8px 0;">
          <a href="${reviewUrl}" target="_blank" style="display: inline-block; border: 2px solid #FFB800; background-color: transparent; color: #1E0E62; font-size: 13px; font-weight: bold; text-decoration: none; padding: 8px 16px; border-radius: 6px;">
            Review ${item.title}
          </a>
        </div>
      `;
    }

    const deliveryFee = order.delivery_method === 'express' ? 2500 : 0;
    const finalTotal = subtotal + deliveryFee;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header (Brand colors) -->
          <div style="background-color: #1E0E62; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; color: #FFB800; font-size: 28px; font-weight: bold;">${brandData.brand_name}</h1>
            <p style="margin: 8px 0 0 0; color: #FFFFFF; font-size: 14px; opacity: 0.9;">${brandData.tagline}</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 24px;">
            <h2 style="margin: 0 0 16px 0; color: #1E0E62; font-size: 20px; font-weight: bold;">Hey ${firstName},</h2>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
              Your payment has been confirmed and your order is being processed.
            </p>

            <!-- Order Summary Table -->
            <h3 style="margin: 0 0 12px 0; color: #1E0E62; font-size: 16px; border-bottom: 2px solid #FFB800; padding-bottom: 6px;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background-color: #EEF2FF;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Item</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Qty</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Price</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px; color: #475569;">Subtotal</td>
                  <td style="padding: 12px; text-align: right; font-size: 14px; color: #334155; font-weight: bold;">₦${Number(subtotal).toLocaleString('en-NG')}</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px; color: #475569;">Delivery (${order.delivery_method === 'express' ? 'Express' : 'Standard'})</td>
                  <td style="padding: 12px; text-align: right; font-size: 14px; color: #334155; font-weight: bold;">₦${Number(deliveryFee).toLocaleString('en-NG')}</td>
                </tr>
                <tr style="background-color: #F8FAFC;">
                  <td colspan="3" style="padding: 12px; text-align: right; font-size: 16px; font-weight: bold; color: #1E0E62;">Total Paid</td>
                  <td style="padding: 12px; text-align: right; font-size: 16px; font-weight: bold; color: #1E0E62; border-top: 2px solid #E2E8F0;">₦${Number(finalTotal).toLocaleString('en-NG')}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Leave a Review Section -->
            <h3 style="margin: 24px 0 12px 0; color: #1E0E62; font-size: 16px; border-bottom: 2px solid #FFB800; padding-bottom: 6px;">Enjoyed your purchase? Leave a review.</h3>
            <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569;">
              Your review helps other students make smarter choices. Click below to rate your items:
            </p>
            <div style="margin-bottom: 24px;">
              ${reviewsHtml}
            </div>

            <!-- Delivery Details Box -->
            <h3 style="margin: 0 0 12px 0; color: #1E0E62; font-size: 16px; border-bottom: 2px solid #FFB800; padding-bottom: 6px;">Delivery Details</h3>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 32px; font-size: 14px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;"><strong>Address:</strong> ${order.delivery_address}</p>
              <p style="margin: 0 0 8px 0;"><strong>State:</strong> ${order.delivery_state}</p>
              ${order.delivery_landmark ? `<p style="margin: 0 0 8px 0;"><strong>Landmark:</strong> ${order.delivery_landmark}</p>` : ''}
              <p style="margin: 0 0 8px 0;"><strong>Method:</strong> ${order.delivery_method === 'express' ? 'Express (Same Day)' : 'Standard (1-2 Days)'}</p>
              <p style="margin: 0;"><strong>Est. Delivery:</strong> 1-2 days</p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #FFB800; color: #1E0E62; font-size: 15px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                Track Your Order
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px; text-align: center; font-size: 12px; color: #64748B; line-height: 1.5;">
            <p style="margin: 0 0 6px 0; font-weight: bold; color: #475569;">Built for students. Backed by trust.</p>
            <p style="margin: 0;">This is an automated transaction receipt. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[Email Service] Attempting to send confirmation email to ${order.customer_email} for order #${order.id}`);
    
    const response = await resend.emails.send({
      from: `${brandData.brand_name} <onboarding@resend.dev>`,
      to: order.customer_email,
      subject: `Order Confirmed — Your ${brandData.brand_name} order is on its way 🎉`,
      html: emailHtml
    });

    console.log(`[Email Service] Resend API Response:`, response);
  } catch (err) {
    console.error('[Email Service] Failed to send order confirmation email:', err);
  }
}

/**
 * Sends a transactional HTML shipment notification email to the customer using Resend.
 * @param {Object} order - The complete order details object from the database.
 */
export async function sendShipmentNotificationEmail(order) {
  if (!resend) {
    console.warn('[Email Service] Resend client not initialized. Check RESEND_API_KEY in .env. Skipping shipment notification email.');
    return;
  }

  try {
    const brandData = await getBrand();
    const firstName = (order.customer_name || '').split(' ')[0] || 'Customer';
    const frontendUrl = brandData.website_url || 'http://localhost:5173';
    const trackingUrl = `${frontendUrl}/track/${order.payment_reference}`;

    // Parse order items
    let items = [];
    try {
      items = typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : order.items_json;
    } catch (e) {
      console.error('Error parsing items JSON for shipment email:', e);
    }

    // Build summary rows with inline styling
    let itemsRows = '';
    let subtotal = 0;
    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      itemsRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: left; font-size: 14px; color: #334155;">${item.title}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 14px; color: #334155;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 14px; color: #334155;">₦${Number(item.price).toLocaleString('en-NG')}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 14px; color: #334155; font-weight: bold;">₦${Number(itemTotal).toLocaleString('en-NG')}</td>
        </tr>
      `;
    }

    const deliveryFee = order.delivery_method === 'express' ? 2500 : 0;
    const finalTotal = subtotal + deliveryFee;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Shipped</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background-color: #1E0E62; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; color: #FFB800; font-size: 28px; font-weight: bold;">${brandData.brand_name}</h1>
            <p style="margin: 8px 0 0 0; color: #FFFFFF; font-size: 14px; opacity: 0.9;">${brandData.tagline}</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 24px;">
            <h2 style="margin: 0 0 16px 0; color: #1E0E62; font-size: 20px; font-weight: bold;">Hey ${firstName},</h2>
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #334155; font-weight: bold;">
              Good news — your order has been shipped! 🚀
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
              We have handed your package over to our delivery partner.
            </p>

            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;"><strong>Order Reference:</strong> <span style="font-family: monospace; font-weight: bold; color: #6366F1;">${order.payment_reference}</span></p>
              <p style="margin: 0 0 8px 0;"><strong>Delivery Method:</strong> ${order.delivery_method === 'express' ? 'Express (Same Day)' : 'Standard (1-2 Days)'}</p>
              <p style="margin: 0;"><strong>Estimated Delivery Timeframe:</strong> 1-2 days</p>
            </div>

            <!-- Product Summary Table -->
            <h3 style="margin: 0 0 12px 0; color: #1E0E62; font-size: 16px; border-bottom: 2px solid #FFB800; padding-bottom: 6px;">Product Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background-color: #EEF2FF;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Item</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Qty</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Price</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px; color: #475569;">Subtotal</td>
                  <td style="padding: 12px; text-align: right; font-size: 14px; color: #334155; font-weight: bold;">₦${Number(subtotal).toLocaleString('en-NG')}</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px; color: #475569;">Delivery (${order.delivery_method === 'express' ? 'Express' : 'Standard'})</td>
                  <td style="padding: 12px; text-align: right; font-size: 14px; color: #334155; font-weight: bold;">₦${Number(deliveryFee).toLocaleString('en-NG')}</td>
                </tr>
                <tr style="background-color: #F8FAFC;">
                  <td colspan="3" style="padding: 12px; text-align: right; font-size: 16px; font-weight: bold; color: #1E0E62;">Total</td>
                  <td style="padding: 12px; text-align: right; font-size: 16px; font-weight: bold; color: #1E0E62; border-top: 2px solid #E2E8F0;">₦${Number(finalTotal).toLocaleString('en-NG')}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Delivery Address Box -->
            <h3 style="margin: 0 0 12px 0; color: #1E0E62; font-size: 16px; border-bottom: 2px solid #FFB800; padding-bottom: 6px;">Delivery Destination</h3>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 32px; font-size: 14px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;"><strong>Address:</strong> ${order.delivery_address}</p>
              <p style="margin: 0 0 8px 0;"><strong>State:</strong> ${order.delivery_state}</p>
              ${order.delivery_landmark ? `<p style="margin: 0 0 8px 0;"><strong>Landmark:</strong> ${order.delivery_landmark}</p>` : ''}
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 32px; margin-top: 24px;">
              <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #FFB800; color: #1E0E62; font-size: 15px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                Track Your Order
              </a>
            </div>

            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748B;">
              If you have any questions or need to make changes to your delivery, please contact our support team at <a href="mailto:${brandData.support_email}" style="color: #6366F1; text-decoration: none;">${brandData.support_email}</a>.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px; text-align: center; font-size: 12px; color: #64748B; line-height: 1.5;">
            <p style="margin: 0 0 6px 0; font-weight: bold; color: #475569;">Built for students. Backed by trust.</p>
            <p style="margin: 0;">This is an automated shipment notification. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`[Email Service] Attempting to send shipment notification email to ${order.customer_email} for order #${order.id}`);

    await resend.emails.send({
      from: `${brandData.brand_name} <onboarding@resend.dev>`,
      to: order.customer_email,
      subject: `${brandData.brand_name} — Your order is on its way!`,
      html: emailHtml
    });
  } catch (err) {
    console.error('[Email Service] Failed to send shipment notification email:', err);
  }
}
