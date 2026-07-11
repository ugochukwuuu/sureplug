import classicLogo from '@/assets/classic/logo.png';
import classicHeroMockup from '@/assets/classic/HeroProductsMockup.png';
import classicRecommendationMockup from '@/assets/classic/Final_AI_Recommendation_Mockup.png';

import minimalLogo from '@/assets/minimal/logo.png';
import minimalHeroMockup from '@/assets/minimal/HeroProductsMockup.png';
import minimalRecommendationMockup from '@/assets/minimal/Final_AI_Recommendation_Mockup.png';

const themeName = import.meta.env.VITE_BRAND_THEME || 'classic';

const assets = {
  logo: themeName === 'minimal' ? minimalLogo : classicLogo,
  heroMockup: themeName === 'minimal' ? minimalHeroMockup : classicHeroMockup,
  recommendationMockup: themeName === 'minimal' ? minimalRecommendationMockup : classicRecommendationMockup
};

export const brand = {
  name: import.meta.env.VITE_BRAND_NAME || 'Sureplug',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Authentic tech. Trusted people. Zero stress.',
  supportPhone: import.meta.env.VITE_BRAND_SUPPORT_PHONE || '2348000000000',
  supportEmail: import.meta.env.VITE_BRAND_SUPPORT_EMAIL || 'hello@sureplug.com',
  theme: themeName,
  logo: assets.logo,
  heroMockup: assets.heroMockup,
  recommendationMockup: assets.recommendationMockup,
  socialHandles: {
    instagram: import.meta.env.VITE_BRAND_INSTAGRAM || '@sureplug',
    twitter: import.meta.env.VITE_BRAND_TWITTER || '@sureplug',
    tiktok: import.meta.env.VITE_BRAND_TIKTOK || '@sureplug'
  }
};
