import { dbAll, dbGet, dbRun } from './db.js';

// Helper to safely parse JSON or return parsed object if database driver already parsed JSONB
const parseJsonField = (field, fallback) => {
  if (field === null || field === undefined) return fallback;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return fallback;
  }
};

// Helper to parse DB row to JS Object format
export const parseProductRow = (row) => {
  if (!row) return null;
  const parsed = {
    ...row,
    is_available: !!row.is_available,
    images: parseJsonField(row.images, []),
    useCases: parseJsonField(row.useCases, []),
    strengths: parseJsonField(row.strengths, []),
    ratings: parseJsonField(row.ratings, {}),
    reviews: parseJsonField(row.reviews, [])
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
    WHERE p.id = $1
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
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
    [
      prod.title,
      prod.brand,
      prod.brand_id,
      prod.category,
      prod.price,
      prod.condition || 'New',
      prod.stock_quantity ?? 5,
      prod.is_available ? true : false,
      typeof prod.images === 'string' ? prod.images : JSON.stringify(prod.images || []),
      prod.description || '',
      specString,
      typeof prod.useCases === 'string' ? prod.useCases : JSON.stringify(prod.useCases || []),
      typeof prod.strengths === 'string' ? prod.strengths : JSON.stringify(prod.strengths || []),
      typeof prod.ratings === 'string' ? prod.ratings : JSON.stringify(prod.ratings || {}),
      typeof prod.reviews === 'string' ? prod.reviews : JSON.stringify(prod.reviews || [])
    ]
  );
  return result.rows[0].id;
};

export const updateProduct = async (id, prod) => {
  const specString = typeof prod.specifications === 'string'
    ? prod.specifications
    : JSON.stringify(prod.specifications || {});

  await dbRun(
    `UPDATE products SET
      title = $1,
      brand = $2,
      brand_id = $3,
      category = $4,
      price = $5,
      condition = $6,
      stock_quantity = $7,
      is_available = $8,
      images = $9,
      description = $10,
      specifications = $11,
      useCases = $12,
      strengths = $13,
      ratings = $14,
      reviews = $15
    WHERE id = $16`,
    [
      prod.title,
      prod.brand,
      prod.brand_id,
      prod.category,
      prod.price,
      prod.condition || 'New',
      prod.stock_quantity ?? 5,
      prod.is_available ? true : false,
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
  await dbRun('DELETE FROM products WHERE id = $1', [id]);
  return true;
};
