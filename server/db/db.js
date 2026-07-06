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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
};

export default db;
