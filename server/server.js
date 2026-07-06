import 'dotenv/config';

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Server cannot start.");
}

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { initDb, dbGet, dbAll, dbRun } from './db/db.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Seed super admin allowed emails
const seedSuperAdmins = async () => {
  try {
    const rawEmails = process.env.SUPER_ADMIN_EMAILS || 'ugobright31@gmail.com';
    const allowedEmails = rawEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    
    for (const email of allowedEmails) {
      const existing = await dbGet('SELECT id FROM allowed_emails WHERE email = ?', [email]);
      if (!existing) {
        await dbRun(
          'INSERT INTO allowed_emails (email, added_by) VALUES (?, ?)',
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
  console.log('SQLite database schema initialized.');
  seedSuperAdmins();
}).catch(err => {
  console.error('Failed to initialize database schema:', err);
});

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sureplug backend active' });
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
    const existing = await dbGet('SELECT * FROM brands WHERE name = ?', [cleanName]);
    if (existing) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    
    const result = await dbRun('INSERT INTO brands (name) VALUES (?)', [cleanName]);
    res.status(201).json({ id: result.id, name: cleanName });
  } catch (err) {
    console.error('Error creating brand:', err);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// Helper to resolve brand_id and brand name before writing product record
const resolveBrandId = async (brandId, brandName) => {
  // If brandId is provided, look up the name in brands table
  if (brandId) {
    const brandRow = await dbGet('SELECT * FROM brands WHERE id = ?', [brandId]);
    if (brandRow) {
      return { brandId, brandName: brandRow.name };
    }
  }

  // If brandName is provided, check if it exists in the brands table
  if (brandName && brandName.trim()) {
    const cleanName = brandName.trim();
    const existing = await dbGet('SELECT * FROM brands WHERE name = ?', [cleanName]);
    if (existing) {
      return { brandId: existing.id, brandName: existing.name };
    } else {
      // Create new brand entry
      const result = await dbRun('INSERT INTO brands (name) VALUES (?)', [cleanName]);
      return { brandId: result.id, brandName: cleanName };
    }
  }

  return { brandId: null, brandName: '' };
};

// REST endpoints for product CRUD
app.get('/api/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, brand, condition, sortBy, search, page, limit, isAdmin } = req.query;
    
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
    if (isAdmin !== 'true') {
      conditions.push('p.is_available = 1');
    }

    // Category filter
    if (category && category !== 'All') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    // Price range filters
    if (minPrice !== undefined) {
      conditions.push('p.price >= ?');
      params.push(Number(minPrice));
    }
    if (maxPrice !== undefined) {
      conditions.push('p.price <= ?');
      params.push(Number(maxPrice));
    }

    // Brand filter (supports array or single string)
    if (brand) {
      const brands = (Array.isArray(brand) ? brand : [brand]).filter(b => b && b.trim() !== '');
      if (brands.length > 0) {
        if (brands.includes('Others')) {
          const standardBrands = ['Apple', 'Samsung', 'HP', 'Lenovo', 'Dell'];
          const placeHolders = brands.filter(b => b !== 'Others').map(() => '?').join(', ');
          const standardPlaceHolders = standardBrands.map(() => '?').join(', ');
          
          let brandSql = '';
          if (placeHolders) {
            brandSql = `(b.name IN (${placeHolders}) OR b.name NOT IN (${standardPlaceHolders}) OR b.name IS NULL)`;
            brands.filter(b => b !== 'Others').forEach(b => params.push(b));
            standardBrands.forEach(sb => params.push(sb));
          } else {
            brandSql = `(b.name NOT IN (${standardPlaceHolders}) OR b.name IS NULL)`;
            standardBrands.forEach(sb => params.push(sb));
          }
          conditions.push(brandSql);
        } else {
          const placeHolders = brands.map(() => '?').join(', ');
          conditions.push(`b.name IN (${placeHolders})`);
          brands.forEach(b => params.push(b));
        }
      }
    }

    // Condition filter (supports array or single string)
    if (condition) {
      const conditionsList = (Array.isArray(condition) ? condition : [condition]).filter(c => c && c.trim() !== '');
      if (conditionsList.length > 0) {
        const placeHolders = conditionsList.map(() => '?').join(', ');
        conditions.push(`p.condition IN (${placeHolders})`);
        conditionsList.forEach(c => params.push(c));
      }
    }

    // Search query matching title, description, brand, category
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push('(p.title LIKE ? OR p.description LIKE ? OR b.name LIKE ? OR p.category LIKE ?)');
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
    query += ' LIMIT ? OFFSET ?';
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
    const products = (await getAllProducts()).filter(p => p.is_available);

    // Check if Gemini API key exists
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here' && geminiKey.trim() !== '') {
      try {
        console.log('Sending request to Gemini API...');
        
        // Prepare prompt
        const systemPrompt = `You are the Sureplug AI Recommender, a helpful assistant finding the best tech devices (laptops, phones, tablets, accessories) for university students.
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
    const isAllowed = await dbGet('SELECT id FROM allowed_emails WHERE email = ?', [cleanEmail]);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Your admin access has been revoked. Contact the system administrator.' });
    }

    const admin = await dbGet('SELECT * FROM admins WHERE email = ?', [cleanEmail]);
    
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
    const isAllowed = await dbGet('SELECT id FROM allowed_emails WHERE email = ?', [cleanEmail]);
    if (!isAllowed) {
      return res.status(403).json({ error: 'This email is not authorized to register as an administrator.' });
    }

    // 2. Check if admin account already exists
    const existing = await dbGet('SELECT id FROM admins WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An admin account with this email already exists.' });
    }

    // 3. Hash password and insert
    const hashedPassword = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO admins (email, password) VALUES (?, ?)',
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
    const existing = await dbGet('SELECT id FROM allowed_emails WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Email is already authorized.' });
    }

    const addedBy = req.admin ? req.admin.email : 'Admin';
    await dbRun(
      'INSERT INTO allowed_emails (email, added_by) VALUES (?, ?)',
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

    await dbRun('DELETE FROM allowed_emails WHERE email = ?', [cleanEmail]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete allowed email error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Checkout API Endpoint
app.post('/api/checkout', async (req, res) => {
  const { cartItems, deliveryInfo, paymentMethod, deliveryMethod } = req.body;

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty or invalid.' });
  }

  if (!deliveryInfo || !deliveryInfo.fullName || !deliveryInfo.phone || !deliveryInfo.email || !deliveryInfo.address || !deliveryInfo.state) {
    return res.status(400).json({ error: 'Missing required delivery details.' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ error: 'Payment method is required.' });
  }

  try {
    // 1. Validate all products existence and stock availability first
    const productsToUpdate = [];
    let calculatedTotal = 0;

    for (const item of cartItems) {
      const product = await dbGet('SELECT * FROM products WHERE id = ?', [item.id]);
      if (!product) {
        return res.status(400).json({ error: `Product with ID ${item.id} not found.` });
      }

      if (product.is_available === 0) {
        return res.status(400).json({ error: `Product '${product.title}' is currently unavailable.` });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for '${product.title}'. Available: ${product.stock_quantity}, Requested: ${item.quantity}.` });
      }

      productsToUpdate.push({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity: item.quantity,
        newStock: product.stock_quantity - item.quantity
      });

      calculatedTotal += product.price * item.quantity;
    }

    // Apply delivery fee calculation
    const isExpress = (deliveryMethod === 'express');
    const deliveryFee = isExpress ? 2500 : 0;
    
    // Apply promo discounts if applicable
    let finalTotal = calculatedTotal + deliveryFee;

    // 2. Perform database stock updates and order insertion
    for (const item of productsToUpdate) {
      await dbRun('UPDATE products SET stock_quantity = ?, is_available = CASE WHEN ? = 0 THEN 0 ELSE is_available END WHERE id = ?', [item.newStock, item.newStock, item.id]);
    }

    const itemsJson = JSON.stringify(productsToUpdate.map(p => ({ id: p.id, title: p.title, price: p.price, quantity: p.quantity })));
    
    const result = await dbRun(
      `INSERT INTO orders (
        customer_name, customer_phone, customer_email, delivery_address, delivery_state, delivery_landmark,
        delivery_method, payment_method, items_json, total_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        finalTotal,
        'pending'
      ]
    );

    res.status(201).json({
      success: true,
      orderId: result.id,
      message: `Order #${result.id} processed successfully. Confirmed!`
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to process checkout transaction.' });
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
    const existing = await dbGet('SELECT id FROM orders WHERE id = ?', [orderId]);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await dbRun('UPDATE orders SET status = ? WHERE id = ?', [status.toLowerCase(), orderId]);
    res.json({ success: true, message: `Order status updated to '${status.toLowerCase()}' successfully.` });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

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

app.listen(PORT, () => {
  console.log(`Sureplug Express server running on http://localhost:${PORT}`);
});
