<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { brand } from '@/config/brand.js';
import { mockProducts } from '../mockProducts';
import ProductCard from '../components/ProductCard.vue';

const router = useRouter();
const searchQuery = ref('');
const activeCategoryTab = ref('All');
const productsList = ref([]);

const popularCategories = ['Laptops', 'Phones', 'Accessories', 'Tablets'];

const fetchProducts = async () => {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      productsList.value = await res.json();
    } else {
      throw new Error('Failed to fetch');
    }
  } catch (e) {
    console.error('Error fetching products from backend:', e);
    productsList.value = mockProducts;
  }
};

onMounted(() => {
  fetchProducts();
});

// Dynamically filter popular products based on tab selection
const filteredProducts = computed(() => {
  let list = productsList.value;
  if (activeCategoryTab.value !== 'All') {
    list = list.filter(p => p.category === activeCategoryTab.value);
  }
  return list.slice(0, 5); // limit to 5 items on home grid
});

const handleSearchSubmit = () => {
  if (searchQuery.value.trim()) {
    router.push({
      path: '/ai-recommender',
      query: { q: searchQuery.value.trim() }
    });
  }
};

const selectTag = (tag) => {
  router.push({
    path: '/marketplace',
    query: { category: tag.toLowerCase() }
  });
};
</script>

<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content page-wrapper">
        <div class="hero-text-block">
          <h1 class="hero-title">
            The smarter way to <span class="text-yellow">buy tech</span> in Nigeria.
          </h1>
          <p class="hero-desc">
            Describe what you need. Our AI finds the best-fit gadgets from verified sellers. Zero bait-and-switch.
          </p>

          <!-- AI input search block -->
          <form class="hero-search-form" @submit.prevent="handleSearchSubmit">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="What device do you need? (e.g. laptop for coding under ₦400k)" 
              class="hero-search-input" 
            />
            <button type="submit" class="hero-search-btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path>
              </svg>
            </button>
          </form>

          <!-- Popular categories tags -->
          <div class="hero-tags-row">
            <span class="tags-label">Popular right now:</span>
            <div class="tags-list">
              <button v-for="cat in popularCategories" :key="cat" class="tag-pill" @click="selectTag(cat)">
                {{ cat }}
              </button>
            </div>
          </div>
        </div>

        <!-- Right side graphic illustrations with yellow auth circle badge -->
        <div class="hero-image-block">
          <div class="hero-image-container">
            <div class="hero-badge-auth-circle">
              <span class="circle-badge-sub">100%</span>
              <span class="circle-badge-main">AUTHENTIC</span>
              <span class="circle-badge-sub">GUARANTEED</span>
            </div>
            <img :src="brand.heroMockup" :alt="`${brand.name} Hero Devices Mockup`" class="hero-mockup-img" />
          </div>
        </div>
      </div>
    </section>

    <!-- Trust Stats Badges Row -->
    <section class="stats-bar-section">
      <div class="stats-bar-wrapper page-wrapper">
        <div class="stats-item">
          <div class="stats-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div>
            <div class="stats-num">10K+</div>
            <div class="stats-lbl">Students Served</div>
          </div>
        </div>
        <div class="stats-item">
          <div class="stats-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <div>
            <div class="stats-num">98%</div>
            <div class="stats-lbl">Positive Reviews</div>
          </div>
        </div>
        <div class="stats-item">
          <div class="stats-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          </div>
          <div>
            <div class="stats-num">1-2 Days</div>
            <div class="stats-lbl">Fast Delivery</div>
          </div>
        </div>
        <div class="stats-item">
          <div class="stats-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div>
            <div class="stats-num">7-Day</div>
            <div class="stats-lbl">Easy Returns</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Popular listings carousel grid -->
    <section class="popular-listings-section page-wrapper section-container">
      <div class="section-header-row">
        <h2 class="section-title">Popular Right Now</h2>
        <div class="category-tabs-list">
          <button 
            v-for="tab in ['All', 'Laptops', 'Phones', 'Accessories']" 
            :key="tab"
            class="tab-pill-btn"
            :class="{ active: activeCategoryTab === tab }"
            @click="activeCategoryTab = tab"
          >
            {{ tab }}
          </button>
        </div>
      </div>

      <div v-if="filteredProducts.length === 0" class="empty-products-state">
        No popular items in this category right now.
      </div>
      
      <div v-else class="product-grid animate-fade-in" :key="activeCategoryTab">
        <ProductCard v-for="prod in filteredProducts" :key="prod.id" :product="prod" />
      </div>

      <div class="view-all-row">
        <router-link to="/marketplace" class="btn btn-navy view-all-btn">
          View All Products
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </router-link>
      </div>
    </section>

    <!-- Try Recommender Banner Section -->
    <section class="recommender-banner-section page-wrapper section-container">
      <div class="banner-card">
        <div class="banner-text-block">
          <h2 class="banner-title">Not sure<br/>what to get?</h2>
          <p class="banner-desc">Tell our AI your budget, your use case, and it'll find your perfect match.</p>
          <router-link to="/ai-recommender" class="btn btn-navy banner-btn">
            Try the AI Recommender
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </router-link>
        </div>
        <div class="banner-graphic-block">
          <img :src="brand.recommendationMockup" :alt="`${brand.name} AI Recommendation`" class="banner-mockup-img" />
        </div>
      </div>
    </section>

    <!-- Bottom trust row -->
    <section class="trust-signal-row-section">
      <div class="trust-signal-row page-wrapper">
        <div class="trust-signal-item">
          <div class="trust-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h4 class="trust-item-title">Every Device is Verified</h4>
          <p class="trust-item-desc">We check every device for authenticity and quality before listing.</p>
        </div>
        <div class="trust-signal-item">
          <div class="trust-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 10v6M19 13h6"></path></svg>
          </div>
          <h4 class="trust-item-title">Every Seller is Trusted</h4>
          <p class="trust-item-desc">All sellers are vetted students or merchants so you can shop with confidence.</p>
        </div>
        <div class="trust-signal-item">
          <div class="trust-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon></svg>
          </div>
          <h4 class="trust-item-title">Hassle-Free Returns</h4>
          <p class="trust-item-desc">Not happy with your tech? Return within 7 days. Zero stress, no stories.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Hero CSS */
.hero-section {
  background-color: var(--color-navy);
  color: var(--color-white);
  padding: 80px 0;
  overflow: hidden;
}

.hero-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 48px;
}

/* Circular yellow auth badge for hero section */
.hero-badge-auth-circle {
  position: absolute;
  top: -30px;
  right: -20px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px;
  z-index: 10;
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 12px;
  line-height: 1.2;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  transform: rotate(-10deg);
  animation: hero-badge-float 3s ease-in-out infinite;
}

.circle-badge-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.circle-badge-main {
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1;
  margin: 2px 0;
}

@keyframes hero-badge-float {
  0%, 100% { transform: translateY(0) rotate(-10deg); }
  50% { transform: translateY(-6px) rotate(-12deg); }
}

.hero-title {
  font-size: 72px;
  line-height: 1.1;
  font-weight: 400;
  color: var(--color-white);
  margin-bottom: 20px;
}

.hero-desc {
  font-size: 18px;
  color: #94A3B8;
  margin-bottom: 32px;
  line-height: 1.6;
}

.hero-search-form {
  position: relative;
  max-width: 580px;
  margin-bottom: 24px;
}

.hero-search-input {
  width: 100%;
  padding: 18px 64px 18px 24px;
  border-radius: 100px;
  border: none;
  background-color: var(--color-white);
  color: var(--color-slate-headings);
  font-size: 15px;
  outline: none;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

.hero-search-input::placeholder {
  color: var(--color-muted-grey);
  opacity: 0.8;
}

.hero-search-btn {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.hero-search-btn:hover {
  background-color: var(--color-yellow-hover);
}

.hero-tags-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #64748B;
}

.tags-label {
  font-weight: 600;
  color: #94A3B8;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-pill {
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: var(--color-white);
  padding: 4px 12px;
  border-radius: 100px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  font-weight: 600;
}

.tag-pill:hover {
  background-color: rgba(255, 255, 255, 0.22);
  border-color: var(--color-yellow);
  color: var(--color-yellow);
}

/* Hero Images Grid layout */
.hero-image-block {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.hero-image-container {
  position: relative;
  width: 100%;
  max-width: 650px;
}

.hero-mockup-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 15px 30px rgba(0, 0, 0, 0.15));
}

/* Stats Bar */
.stats-bar-section {
  background-color: var(--color-yellow);
  padding: 24px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.stats-bar-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--color-navy);
}

.stats-icon {
  width: 48px;
  height: 48px;
  background-color: rgba(10, 15, 41, 0.06);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stats-num {
  font-family: var(--font-headings);
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.stats-lbl {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.8;
}

/* Popular Listings Section */
.popular-listings-section {
  margin-top: 80px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.section-title {
  font-size: 32px;
  font-family: var(--font-headings);
}

.category-tabs-list {
  display: flex;
  gap: 8px;
  background-color: var(--color-white);
  padding: 4px;
  border-radius: 100px;
  border: 1px solid var(--color-border-light);
}

.tab-pill-btn {
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted-grey);
  transition: all 0.2s ease;
}

.tab-pill-btn.active {
  background-color: var(--color-navy);
  color: var(--color-white);
}

.view-all-row {
  display: flex;
  justify-content: center;
  margin-top: 40px;
}

.view-all-btn {
  padding: 14px 32px;
}

.empty-products-state {
  text-align: center;
  padding: 40px;
  color: var(--color-muted-grey);
  font-size: 15px;
}

/* Recommender Banner */
.recommender-banner-section {
  margin-top: 80px;
}

.banner-card {
  background-color: var(--color-yellow);
  border-radius: 24px;
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  overflow: visible;
  padding: 80px 64px;
  min-height: 420px;
  align-items: center;
  gap: 40px;
  position: relative;
}

.banner-text-block {
  color: var(--color-navy);
  z-index: 2;
}

.banner-title {
  font-family: var(--font-display);
  font-size: 60px;
  line-height: 1.05;
  margin-bottom: 16px;
  color: var(--color-navy);
  font-weight: 400;
}

.banner-desc {
  font-size: 18px;
  line-height: 1.5;
  margin-bottom: 32px;
  color: var(--color-navy);
  font-weight: 500;
  max-width: 440px;
}

.banner-btn {
  background-color: var(--color-navy);
  color: var(--color-white);
  padding: 14px 28px;
  font-size: 15px;
  border-radius: 12px;
}

.banner-btn:hover {
  background-color: var(--color-navy-hover);
}

/* Graphics Chat mockup inside yellow banner */
.banner-graphic-block {
  position: relative;
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.banner-mockup-img {
  position: absolute;
  bottom: -200px; /* Sits cleanly inside top boundary */
  right: -32px;
  height: 640px; /* Prominent height slightly taller than card height */
  width: auto;
  object-fit: contain;
  z-index: 5;
  pointer-events: none;
}

/* Trust signal bottom row */
.trust-signal-row-section {
  background-color: #F1F5F9;
  padding: 60px 0;
}

.trust-signal-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 32px;
}

.trust-signal-item {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px;
}

.trust-icon-box {
  width: 56px;
  height: 56px;
  background-color: var(--color-white);
  color: var(--color-purple);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
}

.trust-item-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--color-slate-headings);
}

.trust-item-desc {
  font-size: 13.5px;
  color: var(--color-muted-grey);
  line-height: 1.5;
}

/* Responsiveness overrides */
@media (max-width: 992px) {
  .hero-title {
    font-size: 48px;
  }
  .hero-content {
    grid-template-columns: 1fr;
    gap: 32px;
    text-align: center;
  }
  .hero-search-form {
    margin: 0 auto 24px auto;
  }
  .hero-tags-row {
    justify-content: center;
    flex-wrap: wrap;
  }
  .tags-list {
    justify-content: center;
  }
  .hero-image-block {
    display: none;
  }
  .banner-card {
    grid-template-columns: 1fr;
    padding: 48px 24px;
    text-align: center;
    min-height: auto;
  }
  .banner-title {
    font-size: 40px;
    line-height: 1.1;
  }
  .banner-desc {
    font-size: 16px;
    max-width: 100%;
    margin-bottom: 24px;
  }
  .banner-graphic-block {
    display: none;
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 38px;
  }
  .stats-bar-wrapper {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .trust-signal-row {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}

@media (max-width: 576px) {
  .category-tabs-list {
    overflow-x: auto;
    white-space: nowrap;
    max-width: 100%;
    padding: 6px;
    border-radius: 12px;
    -webkit-overflow-scrolling: touch;
  }
  .tab-pill-btn {
    padding: 8px 14px;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 32px;
  }
  .banner-title {
    font-size: 30px;
  }
  .stats-bar-wrapper {
    grid-template-columns: 1fr;
  }
}
</style>
