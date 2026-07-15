import { initDb, dbRun, dbGet } from './db.js';
import { mockProducts } from '../../src/mockProducts.js';

const seed = async () => {
  try {
    console.log('Initializing database tables...');
    await initDb();

    console.log('Seeding brand config...');
    const brandRowExists = await dbGet('SELECT id FROM brand_config LIMIT 1');
    if (!brandRowExists) {
      await dbRun(`
        INSERT INTO brand_config (brand_name, tagline, support_phone, support_email, active_theme)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, ['Sureplug', 'Authentic tech. Trusted people. Zero stress.', '2348000000000', 'hello@sureplug.com', 'classic']);
    }

    console.log('Seeding mock brands...');
    for (const prod of mockProducts) {
      if (prod.brand) {
        const cleanBrand = prod.brand.trim();
        await dbRun('INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [cleanBrand]);
      }
    }

    console.log('Seeding mock products...');
    for (const prod of mockProducts) {
      // Check if product already exists
      const existing = await dbGet('SELECT id FROM products WHERE id = $1', [prod.id]);
      if (existing) {
        console.log(`Product ID ${prod.id} already exists. Skipping.`);
        continue;
      }

      let brandId = null;
      if (prod.brand) {
        const brandRow = await dbGet('SELECT id FROM brands WHERE name = $1', [prod.brand.trim()]);
        if (brandRow) {
          brandId = brandRow.id;
        }
      }

      await dbRun(
        `INSERT INTO products (
          id, title, brand, brand_id, category, price, condition, stock_quantity,
          images, description, specifications, useCases, strengths, ratings, reviews
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          prod.id,
          prod.title,
          prod.brand,
          brandId,
          prod.category,
          prod.price,
          prod.condition,
          prod.stock_quantity,
          JSON.stringify(prod.images || []),
          prod.description,
          prod.specifications || '{}',
          JSON.stringify(prod.useCases || []),
          JSON.stringify(prod.strengths || []),
          JSON.stringify(prod.ratings || {}),
          JSON.stringify(prod.reviews || [])
        ]
      );
      console.log(`Seeded product: ${prod.title}`);
    }
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding database failed:', error);
    process.exit(1);
  }
};

seed();
