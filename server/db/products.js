import { dbAll, dbGet, dbRun } from './db.js';

// Helper to parse DB row to JS Object format
export const parseProductRow = (row) => {
  if (!row) return null;
  const parsed = {
    ...row,
    is_available: row.is_available !== 0,
    images: JSON.parse(row.images || '[]'),
    useCases: JSON.parse(row.useCases || '[]'),
    strengths: JSON.parse(row.strengths || '[]'),
    ratings: JSON.parse(row.ratings || '{}'),
    reviews: JSON.parse(row.reviews || '[]')
  };
  delete parsed.stock_quantity;
  return parsed;
};

export const getAllProducts = async () => {
  const rows = await dbAll(`
    SELECT p.*, b.name AS brand 
    FROM products p 
    LEFT JOIN brands b ON p.brand_id = b.id
  `);
  return rows.map(parseProductRow);
};

export const getProductById = async (id) => {
  const row = await dbGet(`
    SELECT p.*, b.name AS brand 
    FROM products p 
    LEFT JOIN brands b ON p.brand_id = b.id 
    WHERE p.id = ?
  `, [id]);
  return parseProductRow(row);
};

export const createProduct = async (prod) => {
  const specString = typeof prod.specifications === 'string'
    ? prod.specifications
    : JSON.stringify(prod.specifications || {});

  const result = await dbRun(
    `INSERT INTO products (
      title, brand, brand_id, category, price, condition, stock_quantity, is_available,
      images, description, specifications, useCases, strengths, ratings, reviews
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      prod.title,
      prod.brand,
      prod.brand_id,
      prod.category,
      prod.price,
      prod.condition || 'New',
      prod.stock_quantity ?? 5,
      prod.is_available ? 1 : 0,
      typeof prod.images === 'string' ? prod.images : JSON.stringify(prod.images || []),
      prod.description || '',
      specString,
      typeof prod.useCases === 'string' ? prod.useCases : JSON.stringify(prod.useCases || []),
      typeof prod.strengths === 'string' ? prod.strengths : JSON.stringify(prod.strengths || []),
      typeof prod.ratings === 'string' ? prod.ratings : JSON.stringify(prod.ratings || {}),
      typeof prod.reviews === 'string' ? prod.reviews : JSON.stringify(prod.reviews || [])
    ]
  );
  return result.id;
};

export const updateProduct = async (id, prod) => {
  const specString = typeof prod.specifications === 'string'
    ? prod.specifications
    : JSON.stringify(prod.specifications || {});

  await dbRun(
    `UPDATE products SET
      title = ?,
      brand = ?,
      brand_id = ?,
      category = ?,
      price = ?,
      condition = ?,
      stock_quantity = ?,
      is_available = ?,
      images = ?,
      description = ?,
      specifications = ?,
      useCases = ?,
      strengths = ?,
      ratings = ?,
      reviews = ?
    WHERE id = ?`,
    [
      prod.title,
      prod.brand,
      prod.brand_id,
      prod.category,
      prod.price,
      prod.condition || 'New',
      prod.stock_quantity ?? 5,
      prod.is_available ? 1 : 0,
      typeof prod.images === 'string' ? prod.images : JSON.stringify(prod.images || []),
      prod.description || '',
      specString,
      typeof prod.useCases === 'string' ? prod.useCases : JSON.stringify(prod.useCases || []),
      typeof prod.strengths === 'string' ? prod.strengths : JSON.stringify(prod.strengths || []),
      typeof prod.ratings === 'string' ? prod.ratings : JSON.stringify(prod.ratings || {}),
      typeof prod.reviews === 'string' ? prod.reviews : JSON.stringify(prod.reviews || []),
      id
    ]
  );
  return true;
};

export const deleteProduct = async (id) => {
  await dbRun('DELETE FROM products WHERE id = ?', [id]);
  return true;
};
