import test from 'node:test';
import assert from 'node:assert';
import sqlite3 from 'sqlite3';
import path from 'path';
import { spawn } from 'child_process';
import bcrypt from 'bcrypt';

const dbPath = path.resolve('server/db/sureplug.db');
const db = new sqlite3.Database(dbPath);

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// Start server on port 3800
let serverProcess;

test.before(() => {
  return new Promise((resolve, reject) => {
    console.log('Starting test server on port 3800...');
    serverProcess = spawn('node', ['server/server.js'], {
      env: {
        ...process.env,
        PORT: '3800',
        JWT_SECRET: 'test_jwt_secret_value_for_testing_purposes_only'
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

test('Fix 3: Checkout Endpoint Deducts Stock and Persists Orders', async () => {
  // Find an available product
  const testProd = await dbGet('SELECT id, title, stock_quantity FROM products WHERE is_available = 1 AND stock_quantity > 0 LIMIT 1');
  assert.ok(testProd, 'Should find at least one active product with stock in db');

  const initialStock = testProd.stock_quantity;
  const targetId = testProd.id;

  // Checkout 1 unit
  const res = await fetch('http://localhost:3800/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: [{ id: targetId, quantity: 1 }],
      deliveryInfo: {
        fullName: 'Test Suite Client',
        phone: '08123456789',
        email: 'testsuite@example.com',
        address: '10 Test Lane',
        state: 'Lagos State',
        landmark: 'Test Lab'
      },
      paymentMethod: 'transfer',
      deliveryMethod: 'express'
    })
  });

  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.orderId > 0);

  // Validate stock decrement
  const updatedProd = await dbGet('SELECT stock_quantity FROM products WHERE id = ?', [targetId]);
  assert.strictEqual(updatedProd.stock_quantity, initialStock - 1);

  // Validate order entry in database
  const orderRow = await dbGet('SELECT * FROM orders WHERE id = ?', [data.orderId]);
  assert.ok(orderRow);
  assert.strictEqual(orderRow.customer_name, 'Test Suite Client');
  assert.strictEqual(orderRow.delivery_method, 'express');

  // Verify stock insufficient block
  const blockRes = await fetch('http://localhost:3800/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: [{ id: targetId, quantity: 999999 }], // excess quantity
      deliveryInfo: {
        fullName: 'Test Suite Client',
        phone: '08123456789',
        email: 'testsuite@example.com',
        address: '10 Test Lane',
        state: 'Lagos State',
        landmark: 'Test Lab'
      },
      paymentMethod: 'transfer',
      deliveryMethod: 'express'
    })
  });
  assert.strictEqual(blockRes.status, 400);
  const blockData = await blockRes.json();
  assert.ok(blockData.error.includes('Insufficient stock'));
});

test('Fix 7: Revoked Admin Credentials Fails with 403 Forbidden', async () => {
  // Pre-seed mock revoked admin
  await dbRun('DELETE FROM admins WHERE email = ?', ['revoked_test_suite@example.com']);
  await dbRun('DELETE FROM allowed_emails WHERE email = ?', ['revoked_test_suite@example.com']);

  const hashedPassword = await bcrypt.hash('secretpass', 10);
  await dbRun('INSERT INTO admins (email, password) VALUES (?, ?)', ['revoked_test_suite@example.com', hashedPassword]);

  // Login
  const loginRes = await fetch('http://localhost:3800/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'revoked_test_suite@example.com', password: 'secretpass' })
  });

  assert.strictEqual(loginRes.status, 403);
  const loginData = await loginRes.json();
  assert.ok(loginData.error.includes('revoked'));

  // Clean up
  await dbRun('DELETE FROM admins WHERE email = ?', ['revoked_test_suite@example.com']);
});
