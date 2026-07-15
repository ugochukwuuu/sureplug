import { dbGet } from '../db/db.js';

let cachedBrand = null;
let cacheExpiry = 0;

export function getDefaultBrand() {
  return {
    brand_name: 'Sureplug',
    tagline: 'Authentic tech. Trusted people. Zero stress.',
    support_phone: '2348000000000',
    support_email: 'hello@sureplug.com',
    website_url: 'http://localhost:5173',
    active_theme: 'classic',
    instagram: '@sureplug',
    twitter: '@sureplug',
    tiktok: '@sureplug',
    youtube: '@sureplug',
    whatsapp_number: '2348000000000'
  };
}

export async function getBrand() {
  if (cachedBrand && Date.now() < cacheExpiry) {
    return cachedBrand;
  }
  try {
    const row = await dbGet('SELECT * FROM brand_config LIMIT 1');
    cachedBrand = row || getDefaultBrand();
  } catch (err) {
    console.error('Error fetching brand config from database, using fallback:', err);
    cachedBrand = getDefaultBrand();
  }
  cacheExpiry = Date.now() + 60000;
  return cachedBrand;
}

export function invalidateBrandCache() {
  cachedBrand = null;
  cacheExpiry = 0;
}
