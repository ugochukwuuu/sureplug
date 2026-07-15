import 'dotenv/config';

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Server cannot start.");
}

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { initDb, dbGet, dbAll, dbRun, cls } from './db/db.js';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  parseProductRow
} from './db/products.js';
import { authMiddleware } from './middleware/auth.js';
import { categoriesList } from './config/categories.js';
import { initializePayment, processWebhook, verifyPayment } from './payments/paymentService.js';
import { sendOrderConfirmationEmail, sendShipmentNotificationEmail } from './services/email.js';
import { getBrand, invalidateBrandCache } from './services/brandCache.js';
import { themes } from './config/themes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Correlation ID middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// CLS transaction middleware
app.use((req, res, next) => {
  const store = new Map();
  cls.run(store, () => {
    res.on('finish', () => {
      const client = store.get('client');
      if (client) {
        console.warn(`[TraceID: ${req.correlationId}] Connection leak detected, rolling back transaction`);
        client.query('ROLLBACK').catch(() => {}).finally(() => {
          client.release();
        });
      }
    });
    next();
  });
});

// Simple NAT-friendly in-memory rate limiter
const rateLimits = new Map();
const rateLimiter = (limit = 60, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const sessionKey = req.body?.idempotencyKey || req.query?.reference || 'anon';
    const clientKey = `${ip}_${sessionKey}`;

    const now = Date.now();
    const clientRecord = rateLimits.get(clientKey);

    if (!clientRecord) {
      rateLimits.set(clientKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (now > clientRecord.resetAt) {
      rateLimits.set(clientKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    clientRecord.count++;
    if (clientRecord.count > limit) {
      console.warn(`[TraceID: ${req.correlationId}] Rate limit exceeded for client key: ${clientKey}`);
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    next();
  };
};

// Seed super admin allowed emails
const seedSuperAdmins = async () => {
  try {
    const rawEmails = process.env.SUPER_ADMIN_EMAILS || 'ugobright31@gmail.com';
    const allowedEmails = rawEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    
    for (const email of allowedEmails) {
      const existing = await dbGet('SELECT id FROM allowed_emails WHERE email = $1', [email]);
      if (!existing) {
        await dbRun(
          'INSERT INTO allowed_emails (email, added_by) VALUES ($1, $2)',
          [email, 'System (Super Admin Seed)']
        );
        console.log(`Auto-seeded allowed email: ${email}`);
      }
    }
  } catch (err) {
    console.error('Failed to seed super admin allowed emails:', err);
  }
};

// Initialize database tables on server startup
initDb().then(() => {
  console.log('PostgreSQL database schema initialized.');
  seedSuperAdmins();
}).catch(err => {
  console.error('Failed to initialize database schema:', err);
});

// API health endpoint
app.get('/api/health', async (req, res) => {
  try {
    const brandData = await getBrand();
    res.json({ status: 'ok', message: `${brandData.brand_name} backend active` });
  } catch (err) {
    res.status(500).json({ error: 'Backend error' });
  }
});

// GET /api/config/brand - Public brand settings and theme details
app.get('/api/config/brand', async (req, res) => {
  try {
    const brandData = await getBrand();
    res.json({
      ...brandData,
      themes
    });
  } catch (err) {
    console.error('Error fetching brand config:', err);
    res.status(500).json({ error: 'Failed to fetch brand config' });
  }
});

// GET /api/config/themes - Public list of available themes
app.get('/api/config/themes', (req, res) => {
  res.json(themes);
});

// PUT /api/admin/config/brand - Admin protected brand updates
app.put('/api/admin/config/brand', authMiddleware, async (req, res) => {
  try {
    const active_theme = req.body.active_theme;
    if (active_theme && !themes[active_theme]) {
      return res.status(400).json({ error: `Invalid visual theme: ${active_theme}. Must be one of: ${Object.keys(themes).join(', ')}` });
    }

    const currentBrand = await getBrand();
    const updatedBy = req.admin?.email || 'admin';

    const fieldsToUpdate = [
      'brand_name',
      'tagline',
      'support_phone',
      'support_email',
      'website_url',
      'active_theme',
      'instagram',
      'twitter',
      'tiktok',
      'youtube',
      'whatsapp_number'
    ];

    const updates = [];
    const values = [];
    let placeholderIndex = 1;

    for (const field of fieldsToUpdate) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${placeholderIndex}`);
        values.push(req.body[field]);
        placeholderIndex++;
      }
    }

    if (updates.length > 0) {
      updates.push(`updated_by = $${placeholderIndex}`);
      values.push(updatedBy);
      placeholderIndex++;
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      const rowId = currentBrand.id || 1;
      values.push(rowId);
      const query = `UPDATE brand_config SET ${updates.join(', ')} WHERE id = $${placeholderIndex} RETURNING *`;
      const result = await dbRun(query, values);
      
      invalidateBrandCache();
      
      const updatedBrand = result.rows && result.rows[0] ? result.rows[0] : await getBrand();
      res.json(updatedBrand);
    } else {
      res.json(currentBrand);
    }
  } catch (err) {
    console.error('Error updating brand config:', err);
    res.status(500).json({ error: 'Failed to update brand config' });
  }
});

// Categories config endpoint
app.get('/api/categories', (req, res) => {
  res.json(categoriesList.map(c => typeof c === 'string' ? c : c.name));
});

// Unique brands query endpoint
app.get('/api/brands', async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, name FROM brands ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching brands list:', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Create a new brand (Protected)
app.post('/api/brands', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Brand name is required' });
  }
  
  try {
    const cleanName = name.trim();
    const existing = await dbGet('SELECT * FROM brands WHERE name = $1', [cleanName]);
    if (existing) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    
    const result = await dbRun('INSERT INTO brands (name) VALUES ($1) RETURNING id', [cleanName]);
    res.status(201).json({ id: result.rows[0].id, name: cleanName });
  } catch (err) {
    console.error('Error creating brand:', err);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// Helper to resolve brand_id and brand name before writing product record
const resolveBrandId = async (brandId, brandName) => {
  // If brandId is provided, look up the name in brands table
  if (brandId) {
    const brandRow = await dbGet('SELECT * FROM brands WHERE id = $1', [brandId]);
    if (brandRow) {
      return { brandId, brandName: brandRow.name };
    }
  }

  // If brandName is provided, check if it exists in the brands table
  if (brandName && brandName.trim()) {
    const cleanName = brandName.trim();
    const existing = await dbGet('SELECT * FROM brands WHERE name = $1', [cleanName]);
    if (existing) {
      return { brandId: existing.id, brandName: existing.name };
    } else {
      // Create new brand entry
      const result = await dbRun('INSERT INTO brands (name) VALUES ($1) RETURNING id', [cleanName]);
      return { brandId: result.rows[0].id, brandName: cleanName };
    }
  }

  return { brandId: null, brandName: '' };
};

// REST endpoints for product CRUD
app.get('/api/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, brand, condition, sortBy, search, page, limit, includeUnavailable } = req.query;
    
    let query = `
      SELECT p.*, b.name AS brand 
      FROM products p 
      LEFT JOIN brands b ON p.brand_id = b.id
    `;
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM products p 
      LEFT JOIN brands b ON p.brand_id = b.id
    `;
    const conditions = [];
    const params = [];

    // Availability filter (general storefront only shows available items)
    if (includeUnavailable !== 'true') {
      conditions.push('p.is_available = TRUE');
    }

    // Category filter
    if (category && category !== 'All') {
      conditions.push(`p.category = $${params.length + 1}`);
      params.push(category);
    }

    // Price range filters
    if (minPrice !== undefined) {
      conditions.push(`p.price >= $${params.length + 1}`);
      params.push(Number(minPrice));
    }
    if (maxPrice !== undefined) {
      conditions.push(`p.price <= $${params.length + 1}`);
      params.push(Number(maxPrice));
    }

    // Brand filter (supports array or single string)
    if (brand) {
      const brands = (Array.isArray(brand) ? brand : [brand]).filter(b => b && b.trim() !== '');
      if (brands.length > 0) {
        if (brands.includes('Others')) {
          const standardBrands = ['Apple', 'Samsung', 'HP', 'Lenovo', 'Dell'];
          
          const otherBrands = brands.filter(b => b !== 'Others');
          const otherPlaceholders = [];
          otherBrands.forEach(b => {
            params.push(b);
            otherPlaceholders.push(`$${params.length}`);
          });
          
          const standardPlaceholders = [];
          standardBrands.forEach(sb => {
            params.push(sb);
            standardPlaceholders.push(`$${params.length}`);
          });

          let brandSql = '';
          if (otherPlaceholders.length > 0) {
            brandSql = `(b.name IN (${otherPlaceholders.join(', ')}) OR b.name NOT IN (${standardPlaceholders.join(', ')}) OR b.name IS NULL)`;
          } else {
            brandSql = `(b.name NOT IN (${standardPlaceholders.join(', ')}) OR b.name IS NULL)`;
          }
          conditions.push(brandSql);
        } else {
          const placeholders = [];
          brands.forEach(b => {
            params.push(b);
            placeholders.push(`$${params.length}`);
          });
          conditions.push(`b.name IN (${placeholders.join(', ')})`);
        }
      }
    }

    // Condition filter (supports array or single string)
    if (condition) {
      const conditionsList = (Array.isArray(condition) ? condition : [condition]).filter(c => c && c.trim() !== '');
      if (conditionsList.length > 0) {
        const placeholders = [];
        conditionsList.forEach(c => {
          params.push(c);
          placeholders.push(`$${params.length}`);
        });
        conditions.push(`p.condition IN (${placeholders.join(', ')})`);
      }
    }

    // Search query matching title, description, brand, category
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      const p1 = `$${params.length + 1}`;
      const p2 = `$${params.length + 2}`;
      const p3 = `$${params.length + 3}`;
      const p4 = `$${params.length + 4}`;
      conditions.push(`(p.title LIKE ${p1} OR p.description LIKE ${p2} OR b.name LIKE ${p3} OR p.category LIKE ${p4})`);
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Combine conditions
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Sorting
    if (sortBy) {
      if (sortBy === 'priceLowToHigh' || sortBy === 'price_asc') {
        query += ' ORDER BY p.price ASC';
      } else if (sortBy === 'priceHighToLow' || sortBy === 'price_desc') {
        query += ' ORDER BY p.price DESC';
      } else if (sortBy === 'newest') {
        query += ' ORDER BY p.id DESC';
      } else {
        query += ' ORDER BY p.id ASC';
      }
    } else {
      query += ' ORDER BY p.id ASC';
    }

    // Pagination parameters
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 1000;
    const offsetNum = (pageNum - 1) * limitNum;

    // Get count for pagination
    const countResult = await dbGet(countQuery, params);
    const total = countResult ? countResult.count : 0;

    // Append pagination to select query
    const pLimit = `$${params.length + 1}`;
    const pOffset = `$${params.length + 2}`;
    query += ` LIMIT ${pLimit} OFFSET ${pOffset}`;
    const selectParams = [...params, limitNum, offsetNum];

    const rows = await dbAll(query, selectParams);
    const parsedProducts = rows.map(parseProductRow);

    res.setHeader('X-Total-Count', total);
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.json(parsedProducts);
  } catch (err) {
    console.error('Error fetching products with filters:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getProductById(parseInt(req.params.id, 10));
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error('Error fetching product detail:', err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

// GET validate order reference and product combination before showing review form
app.get('/api/reviews/validate', async (req, res) => {
  const { ref, product } = req.query;
  const productId = parseInt(product, 10);

  if (!ref || isNaN(productId)) {
    return res.json({ valid: false, error: 'Order reference and product ID are required.' });
  }

  try {
    // 1. Check if order reference exists
    const order = await dbGet('SELECT * FROM orders WHERE payment_reference = $1', [ref]);
    if (!order) {
      return res.json({ valid: false, error: 'Invalid order reference. Order not found.' });
    }

    // 2. Check payment status
    if (order.payment_status !== 'paid') {
      return res.json({ valid: false, error: 'Order is not paid yet. Reviews can only be left for paid purchases.' });
    }

    // 3. Check if order contains the product
    let items = [];
    try {
      items = typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : order.items_json;
    } catch (e) {
      return res.json({ valid: false, error: 'Order items payload is corrupt.' });
    }

    const hasProduct = items.some(item => parseInt(item.id, 10) === productId);
    if (!hasProduct) {
      return res.json({ valid: false, error: 'This order does not contain the specified product.' });
    }

    // 4. Check if a review already exists
    const existingReview = await dbGet(
      'SELECT id FROM reviews WHERE product_id = $1 AND order_reference = $2',
      [productId, ref]
    );
    if (existingReview) {
      return res.json({ valid: false, error: 'You have already reviewed this product for this purchase.' });
    }

    res.json({ valid: true, customerName: order.customer_name });
  } catch (err) {
    console.error('Error validating review:', err);
    res.status(500).json({ valid: false, error: 'Internal server error validating review.' });
  }
});

// GET non-flagged reviews for a product
app.get('/api/products/:id/reviews', async (req, res) => {
  const productId = parseInt(req.params.id, 10);

  try {
    const reviews = await dbAll(
      `SELECT id, reviewer_name, reviewer_university, rating, comment, created_at 
       FROM reviews 
       WHERE product_id = $1 AND is_flagged = FALSE 
       ORDER BY created_at DESC`,
      [productId]
    );

    const stats = await dbGet(
      `SELECT COUNT(*) as count, AVG(rating) as "avgRating" 
       FROM reviews 
       WHERE product_id = $1 AND is_flagged = FALSE`,
      [productId]
    );

    res.json({
      reviews,
      totalReviewCount: stats ? parseInt(stats.count, 10) : 0,
      averageRating: stats && stats.avgRating ? parseFloat(parseFloat(stats.avgRating).toFixed(1)) : 0
    });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// POST save verified purchase review
app.post('/api/products/:id/reviews', async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { order_reference, rating, comment } = req.body;
  const ratingInt = parseInt(rating, 10);

  if (!order_reference || isNaN(ratingInt) || !comment) {
    return res.status(400).json({ error: 'Missing required review fields.' });
  }

  if (ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  if (comment.trim().length < 10) {
    return res.status(400).json({ error: 'Review comment must be at least 10 characters long.' });
  }

  try {
    // 1. Verify order reference
    const order = await dbGet('SELECT * FROM orders WHERE payment_reference = $1', [order_reference]);
    if (!order) {
      return res.status(400).json({ error: 'Invalid order reference.' });
    }

    // 2. Verify payment status
    if (order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Order is not paid.' });
    }

    // 3. Verify order contains product_id
    let items = [];
    try {
      items = typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : order.items_json;
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse order items.' });
    }

    const hasProduct = items.some(item => parseInt(item.id, 10) === productId);
    if (!hasProduct) {
      return res.status(400).json({ error: 'This product was not purchased in this order.' });
    }

    // 4. Verify review doesn't exist
    const existing = await dbGet(
      'SELECT id FROM reviews WHERE product_id = $1 AND order_reference = $2',
      [productId, order_reference]
    );
    if (existing) {
      return res.status(400).json({ error: 'A review has already been submitted for this product with this order.' });
    }

    // Auto-fill reviewer name from order record securely
    const reviewer_name = order.customer_name;

    // Save review (university option removed, inserted as NULL)
    await dbRun(
      `INSERT INTO reviews (product_id, order_reference, reviewer_name, reviewer_university, rating, comment, is_flagged)
       VALUES ($1, $2, $3, NULL, $4, $5, FALSE)`,
      [productId, order_reference, reviewer_name.trim(), ratingInt, comment.trim()]
    );

    res.status(201).json({ success: true, message: 'Review saved successfully.' });
  } catch (err) {
    console.error('Error saving review:', err);
    res.status(500).json({ error: 'Failed to save review.' });
  }
});

// POST report / flag a review (marks it as reported, keeps it public until admin-flagged)
app.post('/api/reviews/:id/report', async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);

  try {
    const existing = await dbGet('SELECT id FROM reviews WHERE id = $1', [reviewId]);
    if (!existing) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    await dbRun('UPDATE reviews SET is_reported = TRUE WHERE id = $1', [reviewId]);
    res.json({ success: true, message: 'Review reported successfully.' });
  } catch (err) {
    console.error('Error reporting review:', err);
    res.status(500).json({ error: 'Failed to report review.' });
  }
});

app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const { brand_id, brand_name, brand } = req.body;
    const { brandId, brandName } = await resolveBrandId(brand_id, brand_name || brand);
    
    const productPayload = {
      ...req.body,
      brand_id: brandId,
      brand: brandName
    };

    const newId = await createProduct(productPayload);
    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const { brand_id, brand_name, brand } = req.body;
    const { brandId, brandName } = await resolveBrandId(brand_id, brand_name || brand);
    
    const productPayload = {
      ...req.body,
      brand_id: brandId,
      brand: brandName
    };

    await updateProduct(parseInt(req.params.id, 10), productPayload);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    await deleteProduct(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Helper for local recommendation matching
function runLocalRecommender(userQuery, products) {
  const queryLower = userQuery.toLowerCase().replace(/,/g, '');
  
  // 0. Name matching pass (runs before budget and category filters)
  const nameMatchedIds = [];
  for (const p of products) {
    const titleClean = p.title.toLowerCase();
    const brandClean = p.brand.toLowerCase();
    const modelClean = titleClean.replace(brandClean, '').trim();
    
    const isFullTitleMatch = queryLower.includes(titleClean);
    
    const modelWords = modelClean
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && w !== 'new' && w !== 'used' && w !== 'with');
      
    const isBrandAndModelMatch = queryLower.includes(brandClean) && 
      modelWords.length > 0 && 
      modelWords.every(word => queryLower.includes(word));

    const isModelSubMatch = modelClean.length > 3 && queryLower.includes(modelClean);
    const isTitleSubMatch = titleClean.length > 3 && queryLower.includes(titleClean);
    
    const isShorthandMatch = 
      (titleClean.includes('zephyrus') && queryLower.includes('zephyrus')) ||
      (titleClean.includes('spectre') && queryLower.includes('spectre')) ||
      (titleClean.includes('macbook') && queryLower.includes('macbook')) ||
      (titleClean.includes('xps') && queryLower.includes('xps')) ||
      (titleClean.includes('iphone') && queryLower.includes('iphone'));

    if (isFullTitleMatch || isBrandAndModelMatch || isModelSubMatch || isTitleSubMatch || isShorthandMatch) {
      nameMatchedIds.push(p.id);
    }
  }
  
  // 1. Try to extract budget
  let maxBudget = Infinity;
  const budgetMatch = queryLower.match(/(?:under|below|budget of|max|maximum)?\s*₦?\s*(\d+)\s*(k|thousand|000)?/i);
  if (budgetMatch) {
    let amount = parseInt(budgetMatch[1], 10);
    let multiplier = budgetMatch[2];
    if (multiplier) {
      multiplier = multiplier.toLowerCase();
      if (multiplier === 'k') {
        amount *= 1000;
      } else if (multiplier === 'thousand') {
        amount *= 1000;
      }
    } else if (amount < 1000) {
      amount *= 1000;
    }
    maxBudget = amount;
  }

  // 2. Try to detect category
  let targetCategory = null;
  for (const cat of categoriesList) {
    if (cat.keywords && cat.keywords.some(kw => queryLower.includes(kw))) {
      targetCategory = cat.name;
      break;
    }
  }

  // If a specific category was detected, but we have zero matching products, stop and return a category miss response
  if (targetCategory) {
    const categoryProducts = products.filter(p => p.category === targetCategory);
    if (categoryProducts.length === 0) {
      const availableCategories = [...new Set(products.map(p => p.category))].sort();
      return {
        text: `We don't currently have any ${targetCategory.toLowerCase()} in our catalog. Here are some other categories we carry: ${availableCategories.join(', ')}.`,
        recommendations: []
      };
    }
  }

  // 3. Match use case
  let targetUseCase = null;
  if (queryLower.includes('coding') || queryLower.includes('programming') || queryLower.includes('software') || queryLower.includes('developer')) {
    targetUseCase = 'Programming';
  } else if (queryLower.includes('design') || queryLower.includes('graphics') || queryLower.includes('photoshop') || queryLower.includes('editing') || queryLower.includes('creator')) {
    targetUseCase = 'Graphic Design';
  } else if (queryLower.includes('game') || queryLower.includes('gaming') || queryLower.includes('steam')) {
    targetUseCase = 'Gaming';
  } else if (queryLower.includes('movie') || queryLower.includes('netflix') || queryLower.includes('youtube') || queryLower.includes('screen')) {
    targetUseCase = 'Entertainment';
  } else if (queryLower.includes('note') || queryLower.includes('study') || queryLower.includes('lecture') || queryLower.includes('school') || queryLower.includes('student')) {
    targetUseCase = 'Study';
  }

  // Check if any requirements/keywords are specified in the query
  let hasQueryKeywords = targetCategory || (maxBudget !== Infinity) || targetUseCase || queryLower.includes('battery') || queryLower.includes('portable') || queryLower.includes('lightweight');
  const mentionedBrands = products.map(p => p.brand.toLowerCase()).filter(b => b !== 'others' && queryLower.includes(b));
  if (mentionedBrands.length > 0) {
    hasQueryKeywords = true;
  }

  // 4. Score all products
  const allScoredProducts = products.map(p => {
    let score = 0;
    let matchReasons = [];
    const isNameMatch = nameMatchedIds.includes(p.id);

    if (isNameMatch) {
      score += 150;
      matchReasons.push('Direct match for your requested model.');
    }

    if (targetCategory && p.category === targetCategory) {
      score += 30;
    }

    // Check brand mentions
    if (mentionedBrands.includes(p.brand.toLowerCase())) {
      score += 40;
      matchReasons.push(`Matches your brand preference for ${p.brand}.`);
    }

    // Check use case list
    const useCases = Array.isArray(p.useCases) ? p.useCases : JSON.parse(JSON.stringify(p.useCases || '[]'));
    const useCaseArr = Array.isArray(useCases) ? useCases : JSON.parse(useCases || '[]');
    if (targetUseCase && useCaseArr.some(uc => uc.toLowerCase().includes(targetUseCase.toLowerCase()) || targetUseCase.toLowerCase().includes(uc.toLowerCase()))) {
      score += 40;
      matchReasons.push(`Optimized for ${targetUseCase} use cases.`);
    }

    // Check ratings
    const ratings = typeof p.ratings === 'object' && p.ratings !== null ? p.ratings : JSON.parse(p.ratings || '{}');
    if (targetUseCase && ratings[targetUseCase]) {
      score += ratings[targetUseCase] * 4;
    }

    // Minor score variance using product ratings to avoid identical score ties
    const valueRating = ratings.ValueForMoney || ratings.Performance || 5;
    score += (valueRating / 2);

    // Check strengths
    const strengths = Array.isArray(p.strengths) ? p.strengths : JSON.parse(p.strengths || '[]');
    if (queryLower.includes('battery') && strengths.some(s => s.toLowerCase().includes('battery'))) {
      score += 25;
      matchReasons.push('Features an excellent long-lasting battery.');
    }
    if ((queryLower.includes('portable') || queryLower.includes('lightweight') || queryLower.includes('carry')) && strengths.some(s => s.toLowerCase().includes('portable'))) {
      score += 25;
      matchReasons.push('Super lightweight and portable for lectures.');
    }

    // Calculate final match percentage
    let matchPercentage;
    if (isNameMatch) {
      // Name matches get high prioritized percentages
      matchPercentage = Math.min(98, 94 + Math.round(score / 50));
    } else if (hasQueryKeywords) {
      // Keyword-based query percentages with a minor variance to break ties
      const variance = (p.id % 5) - 2; // -2, -1, 0, 1, or 2
      matchPercentage = Math.min(92, Math.max(58, Math.round(58 + score / 4) + variance));
    } else {
      // Zero keywords - return unique, low values
      const perfRating = ratings.Performance || ratings.Portability || 5;
      matchPercentage = Math.round(50 + (perfRating * 1.5) + (p.id % 5));
    }

    // Bullet points fallback
    if (matchReasons.length === 0) {
      if (strengths.length > 0) {
        matchReasons.push(strengths[0]);
      }
      if (useCaseArr.length > 0) {
        matchReasons.push(`Great for ${useCaseArr.slice(0, 2).join(' and ')}.`);
      }
    }
    if (matchReasons.length < 2 && strengths.length > 1) {
      matchReasons.push(strengths[1]);
    }

    return {
      ...p,
      matchPercentage,
      bulletPoints: matchReasons.slice(0, 2)
    };
  });

  // 5. Build Recommendations List
  let topRecs = [];
  if (nameMatchedIds.length > 0) {
    // A. Separate name matches and other products
    const nameMatches = allScoredProducts.filter(p => nameMatchedIds.includes(p.id));
    nameMatches.sort((a, b) => b.matchPercentage - a.matchPercentage || a.price - b.price);

    // B. Identify the categories of the matched products
    const matchedCategories = [...new Set(nameMatches.map(p => p.category))];
    const referencePrice = nameMatches[0].price;

    // C. Find other products in the SAME category (excluding exact name matches)
    const relatedProducts = allScoredProducts.filter(p => 
      !nameMatchedIds.includes(p.id) && 
      matchedCategories.includes(p.category)
    );

    // D. Sort related products by price closeness and match score
    relatedProducts.sort((a, b) => {
      const diffA = Math.abs(a.price - referencePrice);
      const diffB = Math.abs(b.price - referencePrice);
      return diffA - diffB || b.matchPercentage - a.matchPercentage;
    });

    // E. Combine name matches and related products, keeping up to 3 slots
    topRecs = [...nameMatches, ...relatedProducts].slice(0, 3);
  } else {
    // Standard filter-based recommendations when no name is matched
    const filteredProducts = allScoredProducts.filter(p => {
      return p.price <= maxBudget && (!targetCategory || p.category === targetCategory);
    });
    filteredProducts.sort((a, b) => b.matchPercentage - a.matchPercentage || a.price - b.price);
    topRecs = filteredProducts.slice(0, 3);
  }
  
  let responseText = "Based on your request, I searched our catalog and found these great matches:";
  if (topRecs.length === 0) {
    responseText = "I couldn't find any products in our database matching your exact constraints and budget. Try broadening your criteria or budget.";
  } else if (nameMatchedIds.length > 0) {
    const matchedNames = topRecs.filter(r => nameMatchedIds.includes(r.id)).map(r => r.title);
    responseText = `Here is the details and recommendations for ${matchedNames.join(' and ')} that you requested:`;
  } else {
    responseText = `Here are the top ${topRecs.length} verified devices matching your request:`;
  }

  return {
    text: responseText,
    recommendations: topRecs
  };
}

// AI Recommender endpoint
app.post('/api/ai/recommend', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const brandData = await getBrand();
    const products = (await getAllProducts()).filter(p => p.is_available);

    // Check if Gemini API key exists
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here' && geminiKey.trim() !== '') {
      try {
        console.log('Sending request to Gemini API...');
        
        // Prepare prompt
        const systemPrompt = `You are the ${brandData.brand_name} AI Recommender, a helpful assistant finding the best tech devices (laptops, phones, tablets, accessories) for university students.
You are given a list of available products in the store's database, as well as the chat history.

Your goal is to:
1. Understand the user's needs, such as their budget, what they will use the device for, and any brand preferences.
2. Filter the available products. For example, if they specify a budget like "under 400k", do not recommend products priced above 400,000 NGN.
3. Recommend the best 1-3 matching products from the list.
4. Calculate a matchPercentage (0 to 100) based on how well the device matches their needs (e.g. use cases, strengths, ratings).
5. For each recommended product, provide 2-3 short bullet points explaining why it's a good fit for their specific request (e.g., "M2 processor is perfect for computer science projects", "Battery lasts up to 18 hours, ideal for a full day on campus").
6. Provide a natural, friendly chat response explaining your recommendations.

Here is the current catalog in JSON format:
${JSON.stringify(products.map(p => ({
  id: p.id,
  title: p.title,
  brand: p.brand,
  category: p.category,
  price: p.price,
  condition: p.condition,
  description: p.description,
  useCases: p.useCases,
  strengths: p.strengths,
  ratings: p.ratings
})))}

Respond ONLY in JSON matching this schema:
{
  "text": "friendly natural chat response",
  "recommendations": [
    {
      "id": 1,
      "matchPercentage": 95,
      "bulletPoints": ["point 1", "point 2"]
    }
  ]
}
If no products match the user's constraints or budget, you should state that in the "text" field, and return an empty array for "recommendations".`;

        const formattedHistory = (history || [])
          .filter(h => h.id !== 'greet')
          .map(h => `${h.sender === 'ai' ? 'AI' : 'User'}: ${h.text}`)
          .join('\n');

        const userQueryContent = `Conversation History:\n${formattedHistory}\n\nUser's latest message: "${message}"`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt },
                  { text: userQueryContent }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  recommendations: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        id: { type: 'INTEGER' },
                        matchPercentage: { type: 'INTEGER' },
                        bulletPoints: {
                          type: 'ARRAY',
                          items: { type: 'STRING' }
                        }
                      },
                      required: ['id', 'matchPercentage', 'bulletPoints']
                    }
                  }
                },
                required: ['text', 'recommendations']
              }
            }
          })
        });

        if (response.ok) {
          const result = await response.json();
          const candidates = result.candidates;
          if (candidates && candidates[0]?.content?.parts[0]?.text) {
            const jsonText = candidates[0].content.parts[0].text;
            const data = JSON.parse(jsonText);
            
            const populatedRecommendations = data.recommendations
              .map(rec => {
                const prod = products.find(p => p.id === rec.id);
                if (!prod) return null;
                return {
                  ...prod,
                  matchPercentage: rec.matchPercentage,
                  bulletPoints: rec.bulletPoints
                };
              })
              .filter(Boolean);

            return res.json({
              handler: 'gemini',
              text: data.text,
              recommendations: populatedRecommendations
            });
          }
        }
        
        console.warn('Gemini request failed or parsing failed. Falling back to local scoring...');
      } catch (geminiError) {
        console.error('Error invoking Gemini API:', geminiError);
      }
    }

    // Fallback to Local Deterministic Engine
    console.log('Using Local Deterministic Engine fallback...');
    const fallbackResponse = runLocalRecommender(message, products);
    res.json({
      handler: 'offline',
      ...fallbackResponse
    });

  } catch (err) {
    console.error('Recommender endpoint error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Login Endpoint (Database-driven)
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if email has been revoked
    const isAllowed = await dbGet('SELECT id FROM allowed_emails WHERE email = $1', [cleanEmail]);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Your admin access has been revoked. Contact the system administrator.' });
    }

    const admin = await dbGet('SELECT * FROM admins WHERE email = $1', [cleanEmail]);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (isMatch) {
      const token = jwt.sign(
        { email: admin.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ token });
    } else {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Registration Endpoint (Designated allowed emails only)
app.post('/api/admin/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Check if email is in the allowed_emails registry
    const isAllowed = await dbGet('SELECT id FROM allowed_emails WHERE email = $1', [cleanEmail]);
    if (!isAllowed) {
      return res.status(403).json({ error: 'This email is not authorized to register as an administrator.' });
    }

    // 2. Check if admin account already exists
    const existing = await dbGet('SELECT id FROM admins WHERE email = $1', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An admin account with this email already exists.' });
    }

    // 3. Hash password and insert
    const hashedPassword = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO admins (email, password) VALUES ($1, $2)',
      [cleanEmail, hashedPassword]
    );

    return res.status(201).json({ success: true, message: 'Admin account created successfully.' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET list of allowed emails (Protected)
app.get('/api/admin/allowed-emails', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM allowed_emails ORDER BY id DESC');
    return res.json(rows);
  } catch (err) {
    console.error('Fetch allowed emails error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST authorize a new email (Protected)
app.post('/api/admin/allowed-emails', authMiddleware, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if already allowed
    const existing = await dbGet('SELECT id FROM allowed_emails WHERE email = $1', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Email is already authorized.' });
    }

    const addedBy = req.admin ? req.admin.email : 'Admin';
    await dbRun(
      'INSERT INTO allowed_emails (email, added_by) VALUES ($1, $2)',
      [cleanEmail, addedBy]
    );

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('Add allowed email error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE revoke authorization for an email (Protected)
app.delete('/api/admin/allowed-emails/:email', authMiddleware, async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Prevent deletion of seeded super admin email to avoid complete lockout
    const rawSuperAdmins = process.env.SUPER_ADMIN_EMAILS || 'ugobright31@gmail.com';
    const superAdmins = rawSuperAdmins.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (superAdmins.includes(cleanEmail)) {
      return res.status(400).json({ error: 'Cannot remove a seeded Super Admin email address.' });
    }

    await dbRun('DELETE FROM allowed_emails WHERE email = $1', [cleanEmail]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete allowed email error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Checkout API Endpoint
app.post('/api/checkout', rateLimiter(15, 60000), async (req, res) => {
  const { cartItems, deliveryInfo, paymentMethod, deliveryMethod, idempotencyKey } = req.body;

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency key is required.' });
  }

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty or invalid.' });
  }

  if (!deliveryInfo || !deliveryInfo.fullName || !deliveryInfo.phone || !deliveryInfo.email || !deliveryInfo.address || !deliveryInfo.state) {
    return res.status(400).json({ error: 'Missing required delivery details.' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ error: 'Payment method is required.' });
  }

  console.log(`[TraceID: ${req.correlationId}] Checkout requested. Idempotency Key: ${idempotencyKey}`);

  try {
    // 1. Idempotency Check: Retrieve existing order if key matches
    const existing = await dbGet(
      'SELECT id, checkout_url, payment_reference, payment_method FROM orders WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existing) {
      const isStaleOnlineOrder = (existing.payment_method === 'card' || existing.payment_method === 'transfer') &&
                                 !existing.checkout_url &&
                                 !existing.payment_reference;

      if (isStaleOnlineOrder) {
        console.log(`[TraceID: ${req.correlationId}] Found stale payment session (order #${existing.id}) with null credentials. Deleting stale record to retry.`);
        await dbRun('DELETE FROM orders WHERE id = $1', [existing.id]);
      } else {
        console.log(`[TraceID: ${req.correlationId}] Matching idempotency key found. Returning existing payment URL.`);
        return res.json({
          success: true,
          orderId: existing.id,
          checkoutUrl: existing.checkout_url,
          paymentReference: existing.payment_reference,
          message: 'Retrieved existing active payment session.'
        });
      }
    }

    // 2. Validate products and calculate price totals strictly in integer kobo
    let calculatedTotalKobo = 0;
    const productsList = [];

    for (const item of cartItems) {
      const product = await dbGet('SELECT * FROM products WHERE id = $1', [item.id]);
      if (!product) {
        return res.status(400).json({ error: `Product with ID ${item.id} not found.` });
      }

      if (product.is_available === false || !product.is_available) {
        return res.status(400).json({ error: 'Sorry, this product is no longer available.' });
      }

      const priceKobo = Math.round(product.price * 100);
      calculatedTotalKobo += priceKobo * item.quantity;
      productsList.push({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity: item.quantity
      });
    }

    // Calculate delivery fee in kobo: standard (0 kobo), express (250,000 kobo)
    const deliveryFeeKobo = (deliveryMethod === 'express') ? 250000 : 0;
    const finalTotalKobo = calculatedTotalKobo + deliveryFeeKobo;

    const itemsJson = JSON.stringify(productsList);

    const isOnlinePayment = paymentMethod === 'card' || paymentMethod === 'transfer';

    if (isOnlinePayment) {
      await dbRun('BEGIN');
    }

    try {
      // 3. Store Order record inside database in 'pending' state
      const paymentReference = crypto.randomUUID();
      const result = await dbRun(
        `INSERT INTO orders (
          customer_name, customer_phone, customer_email, delivery_address, delivery_state, delivery_landmark,
          delivery_method, payment_method, items_json, total_amount, total_amount_kobo, payment_status, fulfillment_status, idempotency_key, payment_reference
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [
          deliveryInfo.fullName.trim(),
          deliveryInfo.phone.trim(),
          deliveryInfo.email.trim().toLowerCase(),
          deliveryInfo.address.trim(),
          deliveryInfo.state.trim(),
          (deliveryInfo.landmark || '').trim(),
          deliveryMethod || 'standard',
          paymentMethod,
          itemsJson,
          finalTotalKobo / 100, // standard decimal conversion
          finalTotalKobo,
          'pending',
          'unfulfilled',
          idempotencyKey,
          paymentReference
        ]
      );

      const orderId = result.rows[0].id;

      // 4. Initialize Payment gateway session if paying online (card or transfer)
      if (isOnlinePayment) {
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const redirectUrl = `${frontendBase}/checkout?verifying=true&reference=`;

        const { checkoutUrl, paymentReference: finalReference } = await initializePayment({
          orderId: orderId,
          paymentReference,
          amountKobo: finalTotalKobo,
          customer: {
            name: deliveryInfo.fullName.trim(),
            email: deliveryInfo.email.trim().toLowerCase(),
            phone: deliveryInfo.phone.trim()
          },
          redirectUrl: `${redirectUrl}`,
          correlationId: req.correlationId
        });

        await dbRun('COMMIT');

        return res.status(201).json({
          success: true,
          orderId: orderId,
          checkoutUrl,
          paymentReference: finalReference,
          message: `Order #${orderId} initialized successfully.`
        });
      } else {
        // Pay on Delivery - Settle immediately inside atomic transaction
        await dbRun('BEGIN');
        try {
          let isAllAvailable = true;

          for (const item of productsList) {
            const prod = await dbGet('SELECT title, is_available FROM products WHERE id = $1', [item.id]);
            if (!prod || prod.is_available === false) {
              isAllAvailable = false;
              break;
            }
          }

          if (!isAllAvailable) {
            await dbRun('ROLLBACK');
            return res.status(400).json({ error: 'Sorry, one or more items in your cart are no longer available.' });
          }

          // Update statuses
          await dbRun(
            `UPDATE orders 
             SET payment_status = 'pending', fulfillment_status = 'pending' 
             WHERE id = $1`,
            [orderId]
          );

          await dbRun('COMMIT');

          // Trigger email notification for Pay on Delivery order in the background
          dbGet('SELECT * FROM orders WHERE id = $1', [orderId]).then(updatedOrder => {
            if (updatedOrder) {
              sendOrderConfirmationEmail(updatedOrder).catch(err => {
                console.error('[Server Checkout] Failed to send COD order confirmation email:', err);
              });
            }
          }).catch(err => {
            console.error('[Server Checkout] Failed to fetch updated order for COD email confirmation:', err);
          });

          return res.status(201).json({
            success: true,
            orderId: orderId,
            paymentReference, // return the generated paymentReference for COD order tracking
            message: `Order #${orderId} confirmed for Pay on Delivery.`
          });
        } catch (err) {
          await dbRun('ROLLBACK');
          throw err;
        }
      }
    } catch (err) {
      if (isOnlinePayment) {
        await dbRun('ROLLBACK');
      }
      throw err;
    }
    } catch (err) {
      console.error(`[TraceID: ${req.correlationId}] Checkout processing error:`, err.message || err);
      if (err.statusCode) {
        console.error(`[TraceID: ${req.correlationId}] Korapay Gateway Error Details - Status: ${err.statusCode}, Response Body:`, JSON.stringify(err.responseBody || {}));
      }
      res.status(500).json({ error: 'Failed to process checkout transaction.' });
    }
});

// GET /api/orders/track/:reference (Public)
app.get('/api/orders/track/:reference', async (req, res) => {
  const { reference } = req.params;
  if (!reference) {
    return res.status(400).json({ error: 'Order reference parameter is required.' });
  }

  try {
    const order = await dbGet(
      `SELECT payment_reference, payment_status, fulfillment_status, customer_name, customer_phone, 
              delivery_address, delivery_state, delivery_landmark, delivery_method, items_json, created_at 
       FROM orders 
       WHERE payment_reference = $1`,
      [reference]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Mask phone number: e.g. 08123456789 -> 081****6789 or 080****1234
    const phone = order.customer_phone || '';
    let maskedPhone = '';
    if (phone.length >= 7) {
      maskedPhone = phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
    } else {
      maskedPhone = '***-***';
    }

    // Load images for items
    let items = [];
    try {
      items = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
      for (const item of items) {
        const prod = await dbGet('SELECT images FROM products WHERE id = $1', [item.id]);
        if (prod && prod.images) {
          const imgs = typeof prod.images === 'string' ? JSON.parse(prod.images) : prod.images;
          item.image = imgs[0] || '';
        } else {
          item.image = '';
        }
      }
    } catch (e) {
      console.error('Error parsing items JSON for tracking:', e);
    }

    return res.json({
      success: true,
      order: {
        reference: order.payment_reference,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        customerName: order.customer_name,
        customerPhone: maskedPhone,
        deliveryAddress: order.delivery_address,
        deliveryState: order.delivery_state,
        deliveryLandmark: order.delivery_landmark,
        deliveryMethod: order.delivery_method,
        createdAt: order.created_at,
        items
      }
    });

  } catch (err) {
    console.error(`[TraceID: ${req.correlationId}] Get guest tracking error:`, err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Order Checkout Status
app.get('/api/checkout/status', rateLimiter(120, 60000), async (req, res) => {
  const { reference } = req.query;
  if (!reference) {
    return res.status(400).json({ error: 'Payment reference parameter is required.' });
  }

  try {
    let order = await dbGet(
      'SELECT id, payment_status, fulfillment_status FROM orders WHERE payment_reference = $1',
      [reference]
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Backup check: If local status is pending, directly verify status with the payment provider
    if (order.payment_status === 'pending') {
      console.log(`[TraceID: ${req.correlationId}] Checkout status: local order #${order.id} is pending. Querying payment gateway directly as backup verification.`);
      const verifyResult = await verifyPayment({ reference, correlationId: req.correlationId });
      if (verifyResult.success) {
        // Re-read updated order state
        order = await dbGet(
          'SELECT id, payment_status, fulfillment_status FROM orders WHERE payment_reference = $1',
          [reference]
        );
      }
    }

    return res.json({
      success: true,
      orderId: order.id,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status
    });
  } catch (err) {
    console.error(`[TraceID: ${req.correlationId}] Get checkout status error:`, err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Generic Webhook POST /api/payments/webhook
app.post('/api/payments/webhook', rateLimiter(200, 60000), async (req, res) => {
  try {
    const result = await processWebhook({
      headers: req.headers,
      rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body)),
      correlationId: req.correlationId
    });

    if (result.success) {
      return res.status(result.status || 200).json({ success: true, message: result.message });
    } else {
      // Prompt payment provider to retry if settlement logic fails or throws
      return res.status(result.status || 500).json({ error: result.error });
    }
  } catch (err) {
    console.error(`[TraceID: ${req.correlationId}] Fatal webhook processing exception:`, err);
    return res.status(500).json({ error: 'Internal Webhook Settle Exception' });
  }
});

// GET active orders (Admin Protected)
app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM orders ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin orders list:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// PUT update order status (Admin Protected)
app.put('/api/admin/orders/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const orderId = parseInt(req.params.id, 10);

  if (!status) {
    return res.status(400).json({ error: 'Status string is required.' });
  }

  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const existing = await dbGet('SELECT id FROM orders WHERE id = $1', [orderId]);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await dbRun(
      `UPDATE orders 
       SET status = $1, fulfillment_status = $2 
       WHERE id = $3`,
      [status.toLowerCase(), status.toLowerCase(), orderId]
    );
    res.json({ success: true, message: `Order status updated to '${status.toLowerCase()}' successfully.` });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// GET order statistics (Admin Protected)
app.get('/api/admin/orders/stats', authMiddleware, async (req, res) => {
  try {
    const ordersTodayRow = await dbGet("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURRENT_DATE");
    const revenueTodayRow = await dbGet("SELECT SUM(total_amount) as total FROM orders WHERE payment_status = 'paid' AND DATE(created_at) = CURRENT_DATE");
    const pendingFulfillmentsRow = await dbGet("SELECT COUNT(*) as count FROM orders WHERE fulfillment_status = 'pending'");
    const deliveredAllTimeRow = await dbGet("SELECT COUNT(*) as count FROM orders WHERE fulfillment_status = 'delivered'");

    res.json({
      ordersToday: ordersTodayRow ? ordersTodayRow.count : 0,
      revenueToday: revenueTodayRow && revenueTodayRow.total ? revenueTodayRow.total : 0,
      pendingFulfillments: pendingFulfillmentsRow ? pendingFulfillmentsRow.count : 0,
      deliveredAllTime: deliveredAllTimeRow ? deliveredAllTimeRow.count : 0
    });
  } catch (err) {
    console.error('Error fetching admin orders stats:', err);
    res.status(500).json({ error: 'Failed to fetch order statistics.' });
  }
});

// PUT update order fulfillment status (Admin Protected)
app.put('/api/admin/orders/:id/fulfillment', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const orderId = parseInt(req.params.id, 10);

  if (!status) {
    return res.status(400).json({ error: 'Status is required in request body.' });
  }

  const validStatuses = ['pending', 'processing', 'shipped', 'delivered'];
  if (!validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ error: `Invalid fulfillment status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await dbRun(
      `UPDATE orders 
       SET fulfillment_status = $1, status = $2 
       WHERE id = $3`,
      [status.toLowerCase(), status.toLowerCase(), orderId]
    );

    if (status.toLowerCase() === 'shipped') {
      const updatedOrder = await dbGet('SELECT * FROM orders WHERE id = $1', [orderId]);
      sendShipmentNotificationEmail(updatedOrder).catch(err => {
        console.error('[Server Fulfillment] Failed to send shipment notification email:', err);
      });
    }

    res.json({ success: true, message: `Order fulfillment status updated to '${status.toLowerCase()}' successfully.` });
  } catch (err) {
    console.error('Error updating order fulfillment status:', err);
    res.status(500).json({ error: 'Failed to update order fulfillment status.' });
  }
});

// POST manually trigger payment reconciliation (Admin Protected)
app.post('/api/admin/reconcile', authMiddleware, async (req, res) => {
  const correlationId = `manual_reconcile_${Date.now()}`;
  console.log(`[TraceID: ${correlationId}] Admin manually triggered reconciliation.`);
  
  try {
    const unsettledOrders = await dbAll(
      `SELECT id, payment_reference 
       FROM orders 
       WHERE payment_status = 'pending' 
         AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY id ASC 
       LIMIT 100`
    );

    let reconciledCount = 0;
    for (const order of unsettledOrders) {
      if (order.payment_reference) {
        const check = await verifyPayment({
          reference: order.payment_reference,
          correlationId
        });
        if (check.success) {
          reconciledCount++;
        }
      }
    }

    return res.json({
      success: true,
      message: `Reconciliation check complete. Examined ${unsettledOrders.length} orders. Settled ${reconciledCount} orders.`
    });
  } catch (err) {
    console.error(`[TraceID: ${correlationId}] Manual reconciliation failed:`, err);
    return res.status(500).json({ error: 'Reconciliation runner exception.' });
  }
});

// GET all reviews across products (Admin Protected)
app.get('/api/admin/reviews', authMiddleware, async (req, res) => {
  try {
    const reviews = await dbAll(
      `SELECT r.id, r.product_id, r.order_reference, r.reviewer_name, r.reviewer_university, 
              r.rating, r.comment, CASE WHEN r.is_flagged THEN 1 ELSE 0 END as is_flagged, CASE WHEN r.is_reported THEN 1 ELSE 0 END as is_reported, r.created_at, p.title as product_name
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC`
    );
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching admin reviews list:', err);
    res.status(500).json({ error: 'Failed to fetch reviews list.' });
  }
});

// PUT toggle flagged status on a review (Admin Protected)
app.put('/api/admin/reviews/:id/flag', authMiddleware, async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);

  try {
    const existing = await dbGet('SELECT CASE WHEN is_flagged THEN 1 ELSE 0 END as is_flagged FROM reviews WHERE id = $1', [reviewId]);
    if (!existing) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const newFlag = existing.is_flagged ? 0 : 1;
    await dbRun('UPDATE reviews SET is_flagged = $1 WHERE id = $2', [newFlag === 1, reviewId]);

    res.json({ success: true, is_flagged: newFlag, message: `Review flagged status updated to ${newFlag}.` });
  } catch (err) {
    console.error('Error toggling review flag:', err);
    res.status(500).json({ error: 'Failed to update review flag status.' });
  }
});

// PUT dismiss reported status on a review (Admin Protected)
app.put('/api/admin/reviews/:id/dismiss', authMiddleware, async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);

  try {
    const existing = await dbGet('SELECT id FROM reviews WHERE id = $1', [reviewId]);
    if (!existing) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    await dbRun('UPDATE reviews SET is_reported = FALSE WHERE id = $1', [reviewId]);
    res.json({ success: true, message: 'Review reported status dismissed.' });
  } catch (err) {
    console.error('Error dismissing review report:', err);
    res.status(500).json({ error: 'Failed to dismiss review report.' });
  }
});

// DELETE permanently delete a review (Admin Protected)
app.delete('/api/admin/reviews/:id', authMiddleware, async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);

  try {
    const existing = await dbGet('SELECT id FROM reviews WHERE id = $1', [reviewId]);
    if (!existing) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    await dbRun('DELETE FROM reviews WHERE id = $1', [reviewId]);
    res.json({ success: true, message: 'Review permanently deleted.' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: 'Failed to delete review.' });
  }
});

// Hourly Paginated Reconciliation Task
const runHourlyReconciliation = async () => {
  const correlationId = `reconcile_${Date.now()}`;
  console.log(`[TraceID: ${correlationId}] Starting hourly paginated reconciliation job.`);
  
  const store = new Map();
  cls.run(store, async () => {
    try {
      const unsettledOrders = await dbAll(
        `SELECT id, payment_reference 
         FROM orders 
         WHERE payment_status = 'pending' 
           AND created_at >= NOW() - INTERVAL '24 hours'
         ORDER BY id ASC 
         LIMIT 50`
      );

      console.log(`[TraceID: ${correlationId}] Found ${unsettledOrders.length} pending orders to reconcile.`);
      
      for (const order of unsettledOrders) {
        if (order.payment_reference) {
          await verifyPayment({
            reference: order.payment_reference,
            correlationId
          }).catch(err => {
            console.error(`[TraceID: ${correlationId}] Error reconciling Order #${order.id}:`, err);
          });
        }
      }
    } catch (err) {
      console.error(`[TraceID: ${correlationId}] Reconciliation job failed:`, err);
    } finally {
      const client = store.get('client');
      if (client) {
        client.release();
      }
    }
  });
};

const scheduleReconciliation = () => {
  const now = new Date();
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
  const timeToNextHour = nextHour - now;
  
  setTimeout(() => {
    runHourlyReconciliation();
    setInterval(runHourlyReconciliation, 3600000);
  }, timeToNextHour);
};

scheduleReconciliation();

// Serve built static assets in production
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback for Vue Router client routing
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Watched reload trigger comment

app.listen(PORT, async () => {
  try {
    const brandData = await getBrand();
    console.log(`${brandData.brand_name} Express server running on http://localhost:${PORT}`);
  } catch (err) {
    console.log(`Express server running on http://localhost:${PORT}`);
  }
});
