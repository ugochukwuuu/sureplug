import test from 'node:test';
import assert from 'node:assert';
import pg from 'pg';
import { spawn } from 'child_process';
import crypto from 'crypto';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required to run tests.');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

await client.connect();

const dbGet = async (sql, params = []) => {
  let count = 0;
  const convertedSql = sql.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
  const result = await client.query(convertedSql, params);
  return result.rows[0] !== undefined ? result.rows[0] : undefined;
};

const dbRun = async (sql, params = []) => {
  let count = 0;
  const convertedSql = sql.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
  const result = await client.query(convertedSql, params);
  const lastID = result.rows && result.rows[0] && result.rows[0].id ? result.rows[0].id : null;
  return { id: lastID, changes: result.rowCount || 0 };
};

// Start server on port 3800 in test mode
let serverProcess;
const KORA_TEST_KEY = 'test_kora_secret_key_12345';

test.before(() => {
  return new Promise((resolve, reject) => {
    console.log('Starting test server on port 3800 in test environment...');
    serverProcess = spawn('node', ['server/server.js'], {
      env: {
        ...process.env,
        PORT: '3800',
        NODE_ENV: 'test',
        JWT_SECRET: 'test_jwt_secret_value_for_testing_purposes_only',
        KORA_SECRET_KEY: KORA_TEST_KEY,
        DEFAULT_CURRENCY: 'NGN'
      }
    });

    let started = false;
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running on') && !started) {
        started = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });

    // Timeout safety
    setTimeout(() => {
      if (!started) reject(new Error('Server failed to start in time.'));
    }, 10000);
  });
});

test.after(() => {
  if (serverProcess) {
    console.log('Stopping test server...');
    serverProcess.kill();
  }
  db.close();
});

test('Fix 2: Comma-Separated Budget Parser Matches Correctly', async () => {
  const res = await fetch('http://localhost:3800/api/ai/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'laptop under 1,500,000', history: [] })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.handler, 'offline');
  assert.ok(data.recommendations.length > 0, 'Should return laptops within the 1.5M budget');
});

test('Checkout Idempotency Keys & Server Calculations', async () => {
  const testProd = await dbGet('SELECT id, title, price, stock_quantity FROM products WHERE is_available = TRUE AND stock_quantity > 0 LIMIT 1');
  assert.ok(testProd, 'Should locate an active product');

  const idempotencyKey = crypto.randomUUID();

  // Submission 1
  const res1 = await fetch('http://localhost:3800/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: [{ id: testProd.id, quantity: 1 }],
      deliveryInfo: {
        fullName: 'First Buyer',
        phone: '08123456789',
        email: 'first@example.com',
        address: '10 Test Lane',
        state: 'Lagos State',
        landmark: 'Test Lab'
      },
      paymentMethod: 'card',
      deliveryMethod: 'express',
      idempotencyKey
    })
  });

  assert.strictEqual(res1.status, 201);
  const data1 = await res1.json();
  assert.strictEqual(data1.success, true);
  assert.ok(data1.orderId > 0);
  assert.ok(data1.checkoutUrl);

  // Correlation ID validation
  const correlationHeader = res1.headers.get('X-Correlation-ID');
  assert.ok(correlationHeader, 'X-Correlation-ID should be propagated in headers');

  // Submission 2: Replay checkout
  const res2 = await fetch('http://localhost:3800/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: [{ id: testProd.id, quantity: 1 }],
      deliveryInfo: {
        fullName: 'First Buyer',
        phone: '08123456789',
        email: 'first@example.com',
        address: '10 Test Lane',
        state: 'Lagos State',
        landmark: 'Test Lab'
      },
      paymentMethod: 'card',
      deliveryMethod: 'express',
      idempotencyKey
    })
  });

  assert.strictEqual(res2.status, 200);
  const data2 = await res2.json();
  assert.strictEqual(data2.orderId, data1.orderId);
  assert.strictEqual(data2.checkoutUrl, data1.checkoutUrl);
});

test('Webhook Web Signature, Deduplication & Atomic Settlements', async () => {
  const testProd = await dbGet('SELECT id, title, price, stock_quantity FROM products WHERE is_available = TRUE AND stock_quantity > 2 LIMIT 1');
  assert.ok(testProd, 'Should locate an active product with stock');

  const initialStock = testProd.stock_quantity;
  const targetId = testProd.id;
  const idempotencyKey = crypto.randomUUID();

  // Create checkout
  const checkoutRes = await fetch('http://localhost:3800/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: [{ id: targetId, quantity: 1 }],
      deliveryInfo: {
        fullName: 'Webhook Client',
        phone: '08123456789',
        email: 'webhook@example.com',
        address: '10 Test Lane',
        state: 'Lagos State',
        landmark: 'Test Lab'
      },
      paymentMethod: 'card',
      deliveryMethod: 'standard',
      idempotencyKey
    })
  });

  assert.strictEqual(checkoutRes.status, 201);
  const checkoutData = await checkoutRes.json();
  const paymentRef = checkoutData.paymentReference;

  // Assert stock is NOT decremented yet
  const stockBeforePay = await dbGet('SELECT stock_quantity FROM products WHERE id = ?', [targetId]);
  assert.strictEqual(stockBeforePay.stock_quantity, initialStock, 'Stock must not be reduced at checkout generation');

  // Trigger webhook
  const webhookPayload = {
    event: 'charge.success',
    data: {
      reference: paymentRef,
      status: 'success',
      amount: testProd.price, // standard Naira units
      currency: 'NGN',
      payment_method: 'card',
      transaction_id: `tx_${Date.now()}`
    }
  };

  const rawBodyString = JSON.stringify(webhookPayload);
  const signature = crypto.createHmac('sha256', KORA_TEST_KEY).update(rawBodyString).digest('hex');

  const webhookRes = await fetch('http://localhost:3800/api/payments/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Korapay-Signature': signature
    },
    body: rawBodyString
  });

  assert.strictEqual(webhookRes.status, 200);

  // Validate stock is unchanged after webhook settlement (boolean availability model)
  const stockAfterPay = await dbGet('SELECT stock_quantity FROM products WHERE id = ?', [targetId]);
  assert.strictEqual(stockAfterPay.stock_quantity, initialStock);

  // Validate no inventory movements ledger was written
  const movement = await dbGet('SELECT * FROM inventory_movements WHERE reference = ?', [checkoutData.orderId]);
  assert.strictEqual(movement, undefined);

  // Validate payment status states
  const order = await dbGet('SELECT payment_status, fulfillment_status FROM orders WHERE id = ?', [checkoutData.orderId]);
  assert.strictEqual(order.payment_status, 'paid');
  assert.strictEqual(order.fulfillment_status, 'pending');

  // Send duplicate webhook -> verify duplicate event hash blocks it
  const duplicateWebhookRes = await fetch('http://localhost:3800/api/payments/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Korapay-Signature': signature
    },
    body: rawBodyString
  });
  assert.strictEqual(duplicateWebhookRes.status, 200);
  const duplicateData = await duplicateWebhookRes.json();
  assert.strictEqual(duplicateData.message, 'Duplicate event ignored.');

  // Validate stock was NOT decremented
  const stockAfterDuplicate = await dbGet('SELECT stock_quantity FROM products WHERE id = ?', [targetId]);
  assert.strictEqual(stockAfterDuplicate.stock_quantity, initialStock);
});

test('Webhook Settlement under Stock Depletion Interval', async () => {
  const testProd = await dbGet('SELECT id, title, price, stock_quantity FROM products WHERE is_available = TRUE AND stock_quantity > 0 LIMIT 1');
  assert.ok(testProd, 'Should locate an active product');

  const targetId = testProd.id;
  const initialStock = testProd.stock_quantity;
  const idempotencyKey = crypto.randomUUID();

  // Create checkout
  const checkoutRes = await fetch('http://localhost:3800/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: [{ id: targetId, quantity: initialStock }],
      deliveryInfo: {
        fullName: 'Stale Client',
        phone: '08123456789',
        email: 'stale@example.com',
        address: '10 Test Lane',
        state: 'Lagos State',
        landmark: 'Test Lab'
      },
      paymentMethod: 'card',
      deliveryMethod: 'standard',
      idempotencyKey
    })
  });

  const checkoutData = await checkoutRes.json();
  const paymentRef = checkoutData.paymentReference;

  // Deplete stock in another transaction (simulating stock depletion in the interval before payment)
  await dbRun('UPDATE products SET stock_quantity = 0, is_available = FALSE WHERE id = ?', [targetId]);

  // Trigger webhook
  const webhookPayload = {
    event: 'charge.success',
    data: {
      reference: paymentRef,
      status: 'success',
      amount: testProd.price * initialStock,
      currency: 'NGN',
      payment_method: 'card',
      transaction_id: `tx_depleted_${Date.now()}`
    }
  };

  const rawBodyString = JSON.stringify(webhookPayload);
  const signature = crypto.createHmac('sha256', KORA_TEST_KEY).update(rawBodyString).digest('hex');

  const webhookRes = await fetch('http://localhost:3800/api/payments/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Korapay-Signature': signature
    },
    body: rawBodyString
  });

  assert.strictEqual(webhookRes.status, 200);

  // Validate payment status states: paid but fulfillment failed due to inventory depletion
  const order = await dbGet('SELECT payment_status, fulfillment_status FROM orders WHERE id = ?', [checkoutData.orderId]);
  assert.strictEqual(order.payment_status, 'paid');
  assert.strictEqual(order.fulfillment_status, 'fulfillment_failed');

  // Verify stock quantity did not go negative
  const finalStock = await dbGet('SELECT stock_quantity FROM products WHERE id = ?', [targetId]);
  assert.strictEqual(finalStock.stock_quantity, 0);

  // Restore stock
  await dbRun('UPDATE products SET stock_quantity = ?, is_available = TRUE WHERE id = ?', [initialStock, targetId]);
});

test.after(async () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  await client.end();
});
