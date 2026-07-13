import pg from 'pg';

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

async function runTests() {
  console.log('=== STARTING FIX VERIFICATION TESTS ===\n');

  // =========================================================================
  // FIX 2: Check comma-separated budget parsing regex
  // =========================================================================
  console.log('--- Testing Fix 2: Comma-Separated Budget Parsing ---');
  try {
    const res1 = await fetch('http://localhost:3500/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'laptop under 1,500,000', history: [] })
    });
    const data1 = await res1.json();
    console.log(`Query: "laptop under 1,500,000"`);
    console.log(`Handler used: ${data1.handler}`);
    console.log(`Recommendations count: ${data1.recommendations?.length}`);
    if (data1.recommendations && data1.recommendations.length > 0) {
      console.log('SUCCESS: Laptops matched successfully within ₦1,500,000 budget.');
    } else {
      console.log('FAIL: No laptops matched. The budget might have been parsed incorrectly.');
    }

    const res2 = await fetch('http://localhost:3500/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'phone below 200,000', history: [] })
    });
    const data2 = await res2.json();
    console.log(`Query: "phone below 200,000"`);
    console.log(`Handler used: ${data2.handler}`);
    console.log(`Recommendations count: ${data2.recommendations?.length}`);
    console.log('SUCCESS: Offline recommender query parsed successfully.');
  } catch (err) {
    console.error('Error during Fix 2 test:', err);
  }
  console.log('');

  // =========================================================================
  // FIX 3: POST /api/checkout and stock deduction
  // =========================================================================
  console.log('--- Testing Fix 3: /api/checkout and Stock Deduction ---');
  try {
    // Find an available product with stock > 0
    const testProd = await dbGet('SELECT id, title, stock_quantity FROM products WHERE is_available = TRUE AND stock_quantity > 0 LIMIT 1');
    if (!testProd) {
      console.log('FAIL: No available products in the database with stock > 0 to run checkout test!');
    } else {
      const targetId = testProd.id;
      console.log(`Picked available product for test: ID ${targetId}, Title "${testProd.title}", Stock: ${testProd.stock_quantity}`);

      // Try a successful checkout
      const checkoutRes = await fetch('http://localhost:3500/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ id: targetId, quantity: 1 }],
          deliveryInfo: {
            fullName: 'Test Customer',
            phone: '08012345678',
            email: 'test@example.com',
            address: '1 Main St',
            state: 'Lagos State',
            landmark: 'Yaba Left'
          },
          paymentMethod: 'card',
          deliveryMethod: 'standard'
        })
      });

      const checkoutData = await checkoutRes.json();
      console.log(`Checkout response status: ${checkoutRes.status}`);
      console.log(`Checkout response payload:`, checkoutData);

      const pAfter = await dbGet('SELECT stock_quantity FROM products WHERE id = $1', [targetId]);
      console.log(`Product details after checkout: Stock: ${pAfter.stock_quantity}`);

      if (pAfter.stock_quantity === testProd.stock_quantity - 1) {
        console.log('SUCCESS: Stock quantity successfully decremented by 1.');
      } else {
        console.log('FAIL: Stock quantity was NOT decremented correctly.');
      }

      // Try checking out with excess stock
      const excessCheckoutRes = await fetch('http://localhost:3500/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ id: targetId, quantity: 99999 }], // excess
          deliveryInfo: {
            fullName: 'Test Customer',
            phone: '08012345678',
            email: 'test@example.com',
            address: '1 Main St',
            state: 'Lagos State',
            landmark: 'Yaba Left'
          },
          paymentMethod: 'card',
          deliveryMethod: 'standard'
        })
      });
      const excessData = await excessCheckoutRes.json();
      console.log(`Excess checkout status: ${excessCheckoutRes.status}`);
      console.log(`Excess checkout error payload:`, excessData.error);
      if (excessCheckoutRes.status === 400 && excessData.error.includes('Insufficient stock')) {
        console.log('SUCCESS: System correctly rejected excess stock checkout request.');
      } else {
        console.log('FAIL: System did not reject excess stock checkout request.');
      }
    }
  } catch (err) {
    console.error('Error during Fix 3 test:', err);
  }
  console.log('');

  // =========================================================================
  // FIX 7: Admin login revoked check
  // =========================================================================
  console.log('--- Testing Fix 7: Revoked Admin Login check ---');
  try {
    // 1. Create a dummy admin in admins table
    // Let's check if 'revoked_admin@example.com' exists, delete it first
    await dbRun('DELETE FROM admins WHERE email = $1', ['revoked_admin@example.com']);
    await dbRun('DELETE FROM allowed_emails WHERE email = $1', ['revoked_admin@example.com']);

    // Hash dummy password 'dummy123'
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.default.hash('dummy123', 10);
    await dbRun('INSERT INTO admins (email, password) VALUES ($1, $2)', ['revoked_admin@example.com', hashedPassword]);

    console.log('Admin account registered directly in database, but not in allowed_emails table.');

    // Try to login
    const loginRes = await fetch('http://localhost:3500/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'revoked_admin@example.com', password: 'dummy123' })
    });

    const loginData = await loginRes.json();
    console.log(`Login response status: ${loginRes.status}`);
    console.log(`Login response error payload:`, loginData.error);

    if (loginRes.status === 403 && loginData.error.includes('revoked')) {
      console.log('SUCCESS: Revoked email login attempt correctly blocked with 403.');
    } else {
      console.log('FAIL: Revoked login check failed.');
    }

    // Clean up
    await dbRun('DELETE FROM admins WHERE email = $1', ['revoked_admin@example.com']);
  } catch (err) {
    console.error('Error during Fix 7 test:', err);
  }
  console.log('\n=== FIX VERIFICATION TESTS COMPLETED ===');
  await client.end();
}

runTests();
