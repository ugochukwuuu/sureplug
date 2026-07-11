import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'sureplug.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper to run query (INSERT/UPDATE/DELETE)
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// Helper to get single row
export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Helper to get all rows
export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const initDb = async () => {
  // 1. Create brands table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Create products table (with brand_id column in schema definition for fresh databases)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      brand_id INTEGER,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL,
      is_available INTEGER DEFAULT 1,
      images TEXT NOT NULL,
      description TEXT,
      specifications TEXT,
      useCases TEXT,
      strengths TEXT,
      ratings TEXT,
      reviews TEXT,
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    )
  `);

  // 3. Create admins table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Create allowed_emails table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS allowed_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      added_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Create orders table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_state TEXT NOT NULL,
      delivery_landmark TEXT,
      delivery_method TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      total_amount_kobo INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT DEFAULT 'pending',
      fulfillment_status TEXT DEFAULT 'unfulfilled',
      payment_reference TEXT,
      provider_name TEXT DEFAULT 'kora',
      provider_transaction_id TEXT,
      provider_payment_method TEXT,
      provider_paid_at DATETIME,
      provider_response_code TEXT,
      idempotency_key TEXT,
      checkout_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);


  // 6. Create payment_events table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_reference TEXT NOT NULL,
      event_hash TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      provider_status TEXT,
      headers TEXT NOT NULL,
      payload TEXT NOT NULL,
      verification_duration_ms INTEGER,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Create inventory_movements table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change INTEGER NOT NULL,
      event TEXT NOT NULL,
      reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Create reviews table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      order_reference TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      reviewer_university TEXT,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      is_flagged INTEGER DEFAULT 0,
      is_reported INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (order_reference) REFERENCES orders(payment_reference),
      UNIQUE (product_id, order_reference)
    )
  `);

  // Migrate existing reviews if columns are missing
  const reviewColumns = await dbAll('PRAGMA table_info(reviews)');
  if (!reviewColumns.some(col => col.name === 'is_reported')) {
    console.log('Migrating reviews schema: Adding is_reported column...');
    await dbRun('ALTER TABLE reviews ADD COLUMN is_reported INTEGER DEFAULT 0');
  }

  // Migrate existing orders if table columns are missing
  const orderColumns = await dbAll('PRAGMA table_info(orders)');
  const addColumnIfMissing = async (colName, colDef) => {
    if (!orderColumns.some(col => col.name === colName)) {
      console.log(`Migrating orders schema: Adding ${colName} column...`);
      await dbRun(`ALTER TABLE orders ADD COLUMN ${colName} ${colDef}`);
    }
  };

  await addColumnIfMissing('total_amount_kobo', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('payment_status', "TEXT DEFAULT 'pending'");
  await addColumnIfMissing('fulfillment_status', "TEXT DEFAULT 'unfulfilled'");
  await addColumnIfMissing('payment_reference', 'TEXT');
  await addColumnIfMissing('provider_name', "TEXT DEFAULT 'kora'");
  await addColumnIfMissing('provider_transaction_id', 'TEXT');
  await addColumnIfMissing('provider_payment_method', 'TEXT');
  await addColumnIfMissing('provider_paid_at', 'DATETIME');
  await addColumnIfMissing('provider_response_code', 'TEXT');
  await addColumnIfMissing('idempotency_key', 'TEXT');
  await addColumnIfMissing('checkout_url', 'TEXT');

  // Create unique indexes for unique fields to bypass SQLite's ALTER TABLE constraint limitations
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference)');
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_transaction_id ON orders(provider_transaction_id)');
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key)');


  // 5. Dynamic migration check for existing databases
  const columns = await dbAll('PRAGMA table_info(products)');
  const hasBrandId = columns.some(col => col.name === 'brand_id');
  if (!hasBrandId) {
    console.log('Migrating products schema: Adding brand_id column...');
    await dbRun('ALTER TABLE products ADD COLUMN brand_id INTEGER REFERENCES brands(id)');
  }

  const hasIsAvailable = columns.some(col => col.name === 'is_available');
  if (!hasIsAvailable) {
    console.log('Migrating products schema: Adding is_available column...');
    await dbRun('ALTER TABLE products ADD COLUMN is_available INTEGER DEFAULT 1');
  }

  // 6. Migrate brand text entries to brands table and update products to reference brand_id
  const unlinkedProducts = await dbAll('SELECT id, brand FROM products WHERE brand_id IS NULL');
  if (unlinkedProducts.length > 0) {
    console.log(`Migrating brand strings for ${unlinkedProducts.length} products...`);
    for (const prod of unlinkedProducts) {
      if (prod.brand) {
        const cleanBrand = prod.brand.trim();
        // Check if brand already exists in brands
        let brandRow = await dbGet('SELECT id FROM brands WHERE name = ?', [cleanBrand]);
        let brandId;
        if (brandRow) {
          brandId = brandRow.id;
        } else {
          try {
            const insertRes = await dbRun('INSERT INTO brands (name) VALUES (?)', [cleanBrand]);
            brandId = insertRes.id;
          } catch (e) {
            // Retrieve if exists (duplicate race safeguard)
            const row = await dbGet('SELECT id FROM brands WHERE name = ?', [cleanBrand]);
            brandId = row ? row.id : null;
          }
        }

        if (brandId) {
          await dbRun('UPDATE products SET brand_id = ? WHERE id = ?', [brandId, prod.id]);
        }
      }
    }
    console.log('Brand data migration completed.');
  }

  // Align product availability values with stock quantities to heal stale or null db values
  console.log('Aligning product availability values with stock quantities...');
  await dbRun('UPDATE products SET is_available = 1 WHERE stock_quantity > 0');
  await dbRun('UPDATE products SET is_available = 0 WHERE stock_quantity <= 0 OR stock_quantity IS NULL');
};

export default db;
