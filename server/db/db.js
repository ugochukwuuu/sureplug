import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const { Pool } = pg;

// Export CLS for transaction scoping
export const cls = new AsyncLocalStorage();

if (!process.env.DATABASE_URL) {
  throw new Error('FATAL: DATABASE_URL environment variable is not set. Server cannot start.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper to convert SQLite ? placeholders to PostgreSQL $1 $2 $3 placeholders
export function convertPlaceholders(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
}

// Helper to run query (INSERT/UPDATE/DELETE)
export const dbRun = async (sql, params = []) => {
  const store = cls.getStore();
  const client = (store && store.get('client')) || pool;
  
  const upperSql = sql.trim().toUpperCase();
  
  // Handle transaction commands when called inside CLS / express middleware
  if (upperSql.startsWith('BEGIN')) {
    if (store) {
      if (store.get('client')) {
        return { changes: 0, rows: [] };
      }
      const conn = await pool.connect();
      await conn.query('BEGIN');
      store.set('client', conn);
      return { changes: 0, rows: [] };
    } else {
      console.warn('Warning: BEGIN transaction called outside request CLS context.');
      const conn = await pool.connect();
      await conn.query('BEGIN');
      global.__fallback_db_client = conn;
      return { changes: 0, rows: [] };
    }
  }

  if (upperSql === 'COMMIT') {
    if (store && store.get('client')) {
      const conn = store.get('client');
      await conn.query('COMMIT');
      conn.release();
      store.delete('client');
      return { changes: 0, rows: [] };
    } else if (global.__fallback_db_client) {
      await global.__fallback_db_client.query('COMMIT');
      global.__fallback_db_client.release();
      delete global.__fallback_db_client;
      return { changes: 0, rows: [] };
    }
    return { changes: 0, rows: [] };
  }

  if (upperSql === 'ROLLBACK') {
    if (store && store.get('client')) {
      const conn = store.get('client');
      await conn.query('ROLLBACK');
      conn.release();
      store.delete('client');
      return { changes: 0, rows: [] };
    } else if (global.__fallback_db_client) {
      await global.__fallback_db_client.query('ROLLBACK');
      global.__fallback_db_client.release();
      delete global.__fallback_db_client;
      return { changes: 0, rows: [] };
    }
    return { changes: 0, rows: [] };
  }

  const convertedSql = convertPlaceholders(sql);
  const result = await client.query(convertedSql, params);
  
  // Map PostgreSQL result structure to match expectations
  const lastID = result.rows && result.rows[0] && result.rows[0].id ? result.rows[0].id : null;
  return {
    id: lastID,
    changes: result.rowCount || 0,
    rows: result.rows
  };
};

// Helper to get single row
export const dbGet = async (sql, params = []) => {
  const store = cls.getStore();
  const client = (store && store.get('client')) || pool;
  const convertedSql = convertPlaceholders(sql);
  const result = await client.query(convertedSql, params);
  return result.rows[0] !== undefined ? result.rows[0] : undefined;
};

// Helper to get all rows
export const dbAll = async (sql, params = []) => {
  const store = cls.getStore();
  const client = (store && store.get('client')) || pool;
  const convertedSql = convertPlaceholders(sql);
  const result = await client.query(convertedSql, params);
  return result.rows;
};

export const initDb = async () => {
  // 1. Create brands table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS brands (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Create products table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      brand VARCHAR(255) NOT NULL,
      brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
      category VARCHAR(255) NOT NULL,
      price NUMERIC(12, 2) NOT NULL,
      condition VARCHAR(50) NOT NULL,
      stock_quantity INTEGER NOT NULL,
      is_available BOOLEAN DEFAULT TRUE,
      images JSONB NOT NULL DEFAULT '[]',
      description TEXT,
      specifications JSONB DEFAULT '{}',
      useCases JSONB DEFAULT '[]',
      strengths JSONB DEFAULT '[]',
      ratings JSONB DEFAULT '{}',
      reviews JSONB DEFAULT '[]'
    )
  `);

  // 3. Create admins table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Create allowed_emails table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS allowed_emails (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      added_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Create orders table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_state VARCHAR(100) NOT NULL,
      delivery_landmark TEXT,
      delivery_method VARCHAR(50) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      items_json JSONB NOT NULL DEFAULT '[]',
      total_amount NUMERIC(12, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      total_amount_kobo INTEGER NOT NULL DEFAULT 0,
      payment_status VARCHAR(50) DEFAULT 'pending',
      fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',
      payment_reference VARCHAR(255) UNIQUE,
      provider_name VARCHAR(50) DEFAULT 'kora',
      provider_transaction_id VARCHAR(255) UNIQUE,
      provider_payment_method VARCHAR(100),
      provider_paid_at TIMESTAMP,
      provider_response_code VARCHAR(50),
      idempotency_key VARCHAR(255) UNIQUE,
      checkout_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 6. Create payment_events table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id SERIAL PRIMARY KEY,
      payment_reference VARCHAR(255) NOT NULL,
      event_hash VARCHAR(255) UNIQUE NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      provider_status VARCHAR(50),
      headers TEXT NOT NULL,
      payload TEXT NOT NULL,
      verification_duration_ms INTEGER,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Create inventory_movements table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      change INTEGER NOT NULL,
      event VARCHAR(255) NOT NULL,
      reference VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Create reviews table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      order_reference VARCHAR(255) NOT NULL REFERENCES orders(payment_reference) ON DELETE CASCADE,
      reviewer_name VARCHAR(255) NOT NULL,
      reviewer_university VARCHAR(255),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      is_flagged BOOLEAN DEFAULT FALSE,
      is_reported BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (product_id, order_reference)
    )
  `);

  // Helper to dynamically check if a column exists (PostgreSQL replacement for PRAGMA table_info)
  const checkColumnExists = async (tableName, columnName) => {
    const row = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [tableName.toLowerCase(), columnName.toLowerCase()]);
    return !!row;
  };

  // Migrate existing reviews if columns are missing
  const hasIsReported = await checkColumnExists('reviews', 'is_reported');
  if (!hasIsReported) {
    console.log('Migrating reviews schema: Adding is_reported column...');
    await dbRun('ALTER TABLE reviews ADD COLUMN is_reported BOOLEAN DEFAULT FALSE');
  }

  // Migrate existing orders if table columns are missing
  const addColumnIfMissing = async (colName, colDef) => {
    const hasCol = await checkColumnExists('orders', colName);
    if (!hasCol) {
      console.log(`Migrating orders schema: Adding ${colName} column...`);
      await dbRun(`ALTER TABLE orders ADD COLUMN ${colName} ${colDef}`);
    }
  };

  await addColumnIfMissing('total_amount_kobo', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('payment_status', "VARCHAR(50) DEFAULT 'pending'");
  await addColumnIfMissing('fulfillment_status', "VARCHAR(50) DEFAULT 'unfulfilled'");
  await addColumnIfMissing('payment_reference', 'VARCHAR(255)');
  await addColumnIfMissing('provider_name', "VARCHAR(50) DEFAULT 'kora'");
  await addColumnIfMissing('provider_transaction_id', 'VARCHAR(255)');
  await addColumnIfMissing('provider_payment_method', 'VARCHAR(100)');
  await addColumnIfMissing('provider_paid_at', 'TIMESTAMP');
  await addColumnIfMissing('provider_response_code', 'VARCHAR(50)');
  await addColumnIfMissing('idempotency_key', 'VARCHAR(255)');
  await addColumnIfMissing('checkout_url', 'TEXT');

  // Create unique indexes for unique fields to bypass SQLite's ALTER TABLE constraint limitations
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference)');
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_transaction_id ON orders(provider_transaction_id)');
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key)');

  // 5. Dynamic migration check for existing databases
  const hasProductBrandId = await checkColumnExists('products', 'brand_id');
  if (!hasProductBrandId) {
    console.log('Migrating products schema: Adding brand_id column...');
    await dbRun('ALTER TABLE products ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL');
  }

  const hasProductIsAvailable = await checkColumnExists('products', 'is_available');
  if (!hasProductIsAvailable) {
    console.log('Migrating products schema: Adding is_available column...');
    await dbRun('ALTER TABLE products ADD COLUMN is_available BOOLEAN DEFAULT TRUE');
  }

  // 6. Migrate brand text entries to brands table and update products to reference brand_id
  const unlinkedProducts = await dbAll('SELECT id, brand FROM products WHERE brand_id IS NULL');
  if (unlinkedProducts.length > 0) {
    console.log(`Migrating brand strings for ${unlinkedProducts.length} products...`);
    for (const prod of unlinkedProducts) {
      if (prod.brand) {
        const cleanBrand = prod.brand.trim();
        let brandRow = await dbGet('SELECT id FROM brands WHERE name = $1', [cleanBrand]);
        let brandId;
        if (brandRow) {
          brandId = brandRow.id;
        } else {
          try {
            const insertRes = await dbRun('INSERT INTO brands (name) VALUES ($1) RETURNING id', [cleanBrand]);
            brandId = insertRes.rows[0].id;
          } catch (e) {
            const row = await dbGet('SELECT id FROM brands WHERE name = $1', [cleanBrand]);
            brandId = row ? row.id : null;
          }
        }

        if (brandId) {
          await dbRun('UPDATE products SET brand_id = $1 WHERE id = $2', [brandId, prod.id]);
        }
      }
    }
    console.log('Brand data migration completed.');
  }

  // Align product availability values with stock quantities
  console.log('Aligning product availability values with stock quantities...');
  await dbRun('UPDATE products SET is_available = TRUE WHERE stock_quantity > 0');
  await dbRun('UPDATE products SET is_available = FALSE WHERE stock_quantity <= 0 OR stock_quantity IS NULL');
};

export default pool;
