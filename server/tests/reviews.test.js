import test from 'node:test';
import assert from 'node:assert';
import pg from 'pg';
import { spawn } from 'child_process';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

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

// Start server on port 3900 in test mode
let serverProcess;
const JWT_TEST_SECRET = 'test_jwt_secret_value_for_testing_purposes_only';

// Helper to generate a dummy JWT token for admin auth
const generateTestAdminToken = () => {
  return jwt.sign(
    { email: 'admin@sureplug.com', role: 'admin' },
    JWT_TEST_SECRET,
    { expiresIn: '1h' }
  );
};

test.before(() => {
  return new Promise((resolve, reject) => {
    console.log('Starting test server on port 3900 in test environment...');
    serverProcess = spawn('node', ['server/server.js'], {
      env: {
        ...process.env,
        PORT: '3900',
        NODE_ENV: 'test',
        JWT_SECRET: JWT_TEST_SECRET
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

    setTimeout(() => {
      if (!started) reject(new Error('Server failed to start in time.'));
    }, 10000);
  });
});

test.after(async () => {
  if (serverProcess) {
    console.log('Stopping test server...');
    serverProcess.kill();
  }
  await client.end();
});

test('Verified Purchase Reviews Integration Flow', async () => {
  // 1. Locate product and setup a test paid order containing that product
  const testProduct = await dbGet('SELECT id, title, price FROM products LIMIT 1');
  assert.ok(testProduct, 'Should locate a catalog product');

  const refPaid = 'ref_paid_' + crypto.randomUUID();
  const refUnpaid = 'ref_unpaid_' + crypto.randomUUID();

  // Clean up any stale records from previous failed runs (idempotence)
  await dbRun("DELETE FROM reviews WHERE order_reference LIKE 'ref_paid_%' OR order_reference LIKE 'ref_unpaid_%'");
  await dbRun("DELETE FROM orders WHERE payment_reference LIKE 'ref_paid_%' OR payment_reference LIKE 'ref_unpaid_%'");
  
  const itemsJson = JSON.stringify([{ id: testProduct.id, title: testProduct.title, price: testProduct.price, quantity: 1 }]);
  const otherItemsJson = JSON.stringify([{ id: 9999, title: 'Other Laptop', price: 1000, quantity: 1 }]);

  // Seed Paid Order (Containing product)
  await dbRun(
    `INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_address, delivery_state, delivery_method, payment_method, items_json, total_amount, payment_status, payment_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    ['Test Buyer', '08012345678', 'buyer@example.com', '12 Test St', 'Lagos State', 'standard', 'card', itemsJson, testProduct.price, 'paid', refPaid]
  );

  // Seed Unpaid Order
  await dbRun(
    `INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_address, delivery_state, delivery_method, payment_method, items_json, total_amount, payment_status, payment_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    ['Test Stale Buyer', '08012345678', 'stale@example.com', '12 Test St', 'Lagos State', 'standard', 'card', itemsJson, testProduct.price, 'pending', refUnpaid]
  );

  // 2. Validate Endpoint Check — Invalid reference
  const check1 = await fetch(`http://localhost:3900/api/reviews/validate?ref=invalid_ref_here&product=${testProduct.id}`);
  const data1 = await check1.json();
  assert.strictEqual(data1.valid, false);
  assert.match(data1.error, /not found/i);

  // 3. Validate Endpoint Check — Unpaid reference
  const check2 = await fetch(`http://localhost:3900/api/reviews/validate?ref=${refUnpaid}&product=${testProduct.id}`);
  const data2 = await check2.json();
  assert.strictEqual(data2.valid, false);
  assert.match(data2.error, /not paid/i);

  // 4. Validate Endpoint Check — Paid order but product not inside cart
  const check3 = await fetch(`http://localhost:3900/api/reviews/validate?ref=${refPaid}&product=9999`);
  const data3 = await check3.json();
  assert.strictEqual(data3.valid, false);
  assert.match(data3.error, /not contain/i);

  // 5. Validate Endpoint Check — Valid reference
  const check4 = await fetch(`http://localhost:3900/api/reviews/validate?ref=${refPaid}&product=${testProduct.id}`);
  const data4 = await check4.json();
  assert.strictEqual(data4.valid, true);
  assert.strictEqual(data4.customerName, 'Test Buyer');

  // 6. Submit Review — Too short comment (min 10 characters)
  const submitRes1 = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_reference: refPaid,
      rating: 5,
      comment: 'Bad.'
    })
  });
  assert.strictEqual(submitRes1.status, 400);
  const submitData1 = await submitRes1.json();
  assert.match(submitData1.error, /at least 10 characters/i);

  // 7. Submit Review — Invalid Rating scale (e.g. 0 or 6)
  const submitRes2 = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_reference: refPaid,
      rating: 6,
      comment: 'Awesome device, completely loved it!'
    })
  });
  assert.strictEqual(submitRes2.status, 400);

  // 8. Submit Review — Correct Submission
  const submitRes3 = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_reference: refPaid,
      rating: 5,
      comment: 'Awesome device, completely loved it!'
    })
  });
  assert.strictEqual(submitRes3.status, 201);
  const submitData3 = await submitRes3.json();
  assert.strictEqual(submitData3.success, true);

  // 9. Submit Review — Duplicate submission block
  const submitRes4 = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_reference: refPaid,
      rating: 4,
      comment: 'Trying to submit a duplicate review comment here.'
    })
  });
  assert.strictEqual(submitRes4.status, 400);
  const submitData4 = await submitRes4.json();
  assert.match(submitData4.error, /already/i);

  // 10. GET Reviews — Verify count and stats
  const getRes = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`);
  assert.strictEqual(getRes.status, 200);
  const getData = await getRes.json();
  assert.ok(getData.reviews.length >= 1);
  assert.strictEqual(getData.totalReviewCount, 1);
  assert.strictEqual(getData.averageRating, 5.0);

  // Assert that reviewer_name is auto-filled from order's customer_name and university is null
  const reviewDb = await dbGet('SELECT * FROM reviews WHERE order_reference = $1', [refPaid]);
  assert.ok(reviewDb);
  assert.strictEqual(reviewDb.reviewer_name, 'Test Buyer');
  assert.strictEqual(reviewDb.reviewer_university, null);

  const reportRes = await fetch(`http://localhost:3900/api/reviews/${reviewDb.id}/report`, {
    method: 'POST'
  });
  assert.strictEqual(reportRes.status, 200);

  // 12. GET Reviews — Verify reported review is STILL visible publicly
  const getRes2 = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`);
  const getData2 = await getRes2.json();
  assert.strictEqual(getData2.totalReviewCount, 1, 'Reported review must still be visible publicly');

  // 13. Admin Moderation (Flag, Dismiss, Unflag & Delete)
  const adminToken = generateTestAdminToken();

  // GET admin reviews — check reported status
  const adminGetRes = await fetch(`http://localhost:3900/api/admin/reviews`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminGetRes.status, 200);
  const adminReviewsList = await adminGetRes.json();
  const adminReview = adminReviewsList.find(r => r.id === reviewDb.id);
  assert.ok(adminReview);
  assert.strictEqual(adminReview.is_reported, 1);
  assert.strictEqual(adminReview.is_flagged, 0);

  // PUT Admin Dismiss report on review
  const adminDismissRes = await fetch(`http://localhost:3900/api/admin/reviews/${reviewDb.id}/dismiss`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminDismissRes.status, 200);
  const dismissData = await adminDismissRes.json();
  assert.strictEqual(dismissData.success, true);
  
  const dbCheckReported = await dbGet('SELECT CASE WHEN is_reported THEN 1 ELSE 0 END as is_reported FROM reviews WHERE id = $1', [reviewDb.id]);
  assert.strictEqual(dbCheckReported.is_reported, 0, 'Dismissing a report must clear the is_reported flag');

  // PUT Admin Flag review — hides it from public GET
  const adminFlagRes = await fetch(`http://localhost:3900/api/admin/reviews/${reviewDb.id}/flag`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminFlagRes.status, 200);
  const flagData = await adminFlagRes.json();
  assert.strictEqual(flagData.is_flagged, 1);

  const getRes3 = await fetch(`http://localhost:3900/api/products/${testProduct.id}/reviews`);
  const getData3 = await getRes3.json();
  assert.strictEqual(getData3.totalReviewCount, 0, 'Flagged review must be hidden from public GET');

  // PUT Admin Unflag review
  const adminUnflagRes = await fetch(`http://localhost:3900/api/admin/reviews/${reviewDb.id}/flag`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminUnflagRes.status, 200);
  const unflagData = await adminUnflagRes.json();
  assert.strictEqual(unflagData.is_flagged, 0);

  // DELETE Admin delete review
  const adminDeleteRes = await fetch(`http://localhost:3900/api/admin/reviews/${reviewDb.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminDeleteRes.status, 200);

  // Verify deletion from database
  const finalDbCheck = await dbGet('SELECT * FROM reviews WHERE id = $1', [reviewDb.id]);
  assert.strictEqual(finalDbCheck, undefined);

  // Clean up order records
  await dbRun('DELETE FROM orders WHERE payment_reference IN ($1, $2)', [refPaid, refUnpaid]);
});
