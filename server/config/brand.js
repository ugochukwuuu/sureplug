export const brand = {
  name: process.env.BRAND_NAME || 'Sureplug',
  tagline: process.env.BRAND_TAGLINE || 'Authentic tech. Trusted people. Zero stress.',
  supportPhone: process.env.BRAND_SUPPORT_PHONE || '2348000000000',
  supportEmail: process.env.BRAND_SUPPORT_EMAIL || 'hello@sureplug.com',
  websiteUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  socialHandles: {
    instagram: process.env.BRAND_INSTAGRAM || '@sureplug',
    twitter: process.env.BRAND_TWITTER || '@sureplug',
    tiktok: process.env.BRAND_TIKTOK || '@sureplug',
  }
};
