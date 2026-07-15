import { reactive } from 'vue';
import { themes } from '@/config/themes.js';

import classicLogo from '@/assets/classic/logo.png';
import classicHeroMockup from '@/assets/classic/HeroProductsMockup.png';
import classicRecommendationMockup from '@/assets/classic/Final_AI_Recommendation_Mockup.png';

import minimalLogo from '@/assets/minimal/logo.png';
import minimalHeroMockup from '@/assets/minimal/HeroProductsMockup.png';
import minimalRecommendationMockup from '@/assets/minimal/Final_AI_Recommendation_Mockup.png';

const DEFAULT_BRAND = {
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

export const brandConfig = reactive({
  ...DEFAULT_BRAND,
  get logo() {
    return this.active_theme === 'minimal' ? minimalLogo : classicLogo;
  },
  get heroMockup() {
    return this.active_theme === 'minimal' ? minimalHeroMockup : classicHeroMockup;
  },
  get recommendationMockup() {
    return this.active_theme === 'minimal' ? minimalRecommendationMockup : classicRecommendationMockup;
  }
});

export async function loadBrandConfig() {
  try {
    const res = await fetch('/api/config/brand');
    if (res.ok) {
      const data = await res.json();
      Object.assign(brandConfig, data);
      applyTheme(data.active_theme);
    } else {
      console.warn('Brand config endpoint returned error response, using defaults');
      applyTheme(DEFAULT_BRAND.active_theme);
    }
  } catch (err) {
    console.warn('Brand config fetch failed, using defaults:', err);
    applyTheme(DEFAULT_BRAND.active_theme);
  }
}

export function applyTheme(themeKey) {
  const theme = themes[themeKey] || themes['classic'];
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}
