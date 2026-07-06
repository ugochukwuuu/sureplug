<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { mockProducts } from '../mockProducts';
import ProductCard from '../components/ProductCard.vue';

const route = useRoute();
const router = useRouter();

// UI triggers
const isSidebarOpen = ref(true);
const isStickyBannerVisible = ref(true);

// State filter values
const searchQuery = ref('');
const activeCategoryTab = ref('All');
const minPrice = ref(50000);
const maxPrice = ref(800000);
const selectedBrands = ref([]);
const selectedConditions = ref([]);
const sortBy = ref('recommended');
const productsList = ref([]);
const totalProducts = ref(0);

const categoryTabs = ['All', 'Laptops', 'Phones', 'Tablets', 'Accessories', 'Gaming', 'Audio'];
const brandList = ['Apple', 'Samsung', 'HP', 'Lenovo', 'Dell', 'Others'];

const fetchProducts = async () => {
  try {
    const params = new URLSearchParams();
    
    if (activeCategoryTab.value && activeCategoryTab.value !== 'All') {
      params.append('category', activeCategoryTab.value);
    }
    
    params.append('minPrice', minPrice.value);
    params.append('maxPrice', maxPrice.value);
    
    selectedBrands.value.forEach(brand => {
      params.append('brand', brand);
    });
    
    selectedConditions.value.forEach(condition => {
      params.append('condition', condition);
    });
    
    params.append('sortBy', sortBy.value);
    
    if (searchQuery.value && searchQuery.value.trim() !== '') {
      params.append('search', searchQuery.value.trim());
    }

    const res = await fetch(`/api/products?${params.toString()}`);
    if (res.ok) {
      productsList.value = await res.json();
      totalProducts.value = productsList.value.length;
    } else {
      throw new Error('Failed to fetch products');
    }
  } catch (e) {
    console.error('Error fetching products:', e);
    // Offline local fallback
    totalProducts.value = mockProducts.length;
    productsList.value = mockProducts;
  }
};

// Parse incoming queries from other pages
onMounted(async () => {
  if (route.query.category) {
    const matchedTab = categoryTabs.find(tab => tab.toLowerCase() === route.query.category.toLowerCase());
    if (matchedTab) activeCategoryTab.value = matchedTab;
  }
  if (route.query.search || route.query.q) {
    searchQuery.value = route.query.search || route.query.q || '';
  }
  await fetchProducts();
});

// Watch search query with 300ms debounce
let searchDebounceTimeout = null;
watch(searchQuery, () => {
  if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    fetchProducts();
  }, 300);
});

// Watch remaining filters to refetch
watch([activeCategoryTab, minPrice, maxPrice, selectedBrands, selectedConditions, sortBy], () => {
  fetchProducts();
}, { deep: true });

// Return loaded products list directly
const filteredProducts = computed(() => {
  return productsList.value;
});

// Group products into rows dynamically
const sectionedProducts = computed(() => {
  const list = productsList.value;
  if (list.length === 0) return [];

  if (activeCategoryTab.value === 'All') {
    // Group by category
    const categoriesMap = {};
    list.forEach(p => {
      if (!categoriesMap[p.category]) {
        categoriesMap[p.category] = [];
      }
      categoriesMap[p.category].push(p);
    });

    // Convert map to sorted list of sections
    return Object.keys(categoriesMap).map(catName => ({
      title: catName,
      products: categoriesMap[catName]
    })).sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // Group by brand
    const brandsMap = {};
    list.forEach(p => {
      const bName = p.brand || 'Others';
      if (!brandsMap[bName]) {
        brandsMap[bName] = [];
      }
      brandsMap[bName].push(p);
    });

    // Convert map to sorted list of sections
    return Object.keys(brandsMap).map(bName => ({
      title: bName,
      products: brandsMap[bName]
    })).sort((a, b) => a.title.localeCompare(b.title));
  }
});

// Selected Chips formatting
const activeChips = computed(() => {
  const chips = [];
  if (activeCategoryTab.value !== 'All') {
    chips.push({ type: 'category', label: `Category: ${activeCategoryTab.value}` });
  }
  if (minPrice.value > 50000 || maxPrice.value < 800000) {
    chips.push({ type: 'price', label: `Price: ₦${minPrice.value.toLocaleString()} - ₦${maxPrice.value.toLocaleString()}` });
  }
  selectedBrands.value.forEach(b => {
    chips.push({ type: 'brand', label: `Brand: ${b}`, value: b });
  });
  selectedConditions.value.forEach(c => {
    chips.push({ type: 'condition', label: `Condition: ${c}`, value: c });
  });
  return chips;
});

const removeChip = (chip) => {
  if (chip.type === 'category') activeCategoryTab.value = 'All';
  if (chip.type === 'price') {
    minPrice.value = 50000;
    maxPrice.value = 800000;
  }
  if (chip.type === 'brand') {
    selectedBrands.value = selectedBrands.value.filter(b => b !== chip.value);
  }
  if (chip.type === 'condition') {
    selectedConditions.value = selectedConditions.value.filter(c => c !== chip.value);
  }
};

const clearAllFilters = () => {
  activeCategoryTab.value = 'All';
  searchQuery.value = '';
  minPrice.value = 50000;
  maxPrice.value = 800000;
  selectedBrands.value = [];
  selectedConditions.value = [];
  sortBy.value = 'recommended';
};

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

const selectCategory = (catName) => {
  activeCategoryTab.value = catName;
};
</script>

<template>
  <div class="marketplace-view">
    <!-- Blue Header Banner -->
    <header class="marketplace-header">
      <div class="marketplace-header-content page-wrapper">
        <div>
          <h1 class="marketplace-title">The Marketplace.</h1>
          <p class="marketplace-subtitle">Every device verified. Every seller trusted.</p>
        </div>
        <button class="ai-banner-badge" @click="router.push('/ai-recommender')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path></svg>
          Not sure what to get? Try the AI.
        </button>
      </div>
    </header>

    <div class="page-wrapper main-market-layout">
      <!-- Search/Filter Controls -->
      <section class="controls-section">
        <div class="controls-row">
          <!-- Search input -->
          <div class="search-input-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input v-model="searchQuery" type="text" placeholder="Search laptops, phones, accessories..." class="search-input-field" />
          </div>

          <!-- Quick Filters Dropdowns / Controls Toggle -->
          <div class="quick-filters">
            <button class="btn btn-yellow filter-toggle-btn" @click="isSidebarOpen = !isSidebarOpen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
              Filter
            </button>
          </div>
        </div>

        <!-- Filter Chips Row -->
        <div v-if="activeChips.length > 0" class="filter-chips-row animate-fade-in">
          <div v-for="chip in activeChips" :key="chip.label" class="filter-chip">
            <span>{{ chip.label }}</span>
            <button class="chip-close-btn" @click="removeChip(chip)">×</button>
          </div>
          <button class="clear-all-btn" @click="clearAllFilters">Clear all</button>
        </div>

        <!-- Category horizontal tabs -->
        <div class="category-tabs-row">
          <div class="category-tabs-scroll">
            <button 
              v-for="cat in categoryTabs" 
              :key="cat" 
              class="cat-tab-link"
              :class="{ active: activeCategoryTab === cat }"
              @click="activeCategoryTab = cat"
            >
              {{ cat }}
            </button>
          </div>
        </div>
      </section>

      <div class="catalog-layout">
        <!-- Sidebar Filter Drawer -->
        <aside v-if="isSidebarOpen" class="filter-sidebar animate-fade-in">
          <!-- Price Range Slider Group -->
          <div class="sidebar-filter-block">
            <h4 class="sidebar-block-title">Price Range</h4>
            <div class="price-slider-info">
              <span>{{ formatPrice(minPrice) }}</span>
              <span>—</span>
              <span>{{ formatPrice(maxPrice) }}</span>
            </div>
            <div class="price-slider-controls">
              <input type="range" min="50000" max="800000" step="10000" v-model.number="minPrice" class="range-slider" />
              <input type="range" min="50000" max="800000" step="10000" v-model.number="maxPrice" class="range-slider" />
            </div>
          </div>

          <!-- Brand Checkboxes -->
          <div class="sidebar-filter-block">
            <h4 class="sidebar-block-title">Brand</h4>
            <div class="checkbox-list">
              <label v-for="brand in brandList" :key="brand" class="check-item">
                <input type="checkbox" :value="brand" v-model="selectedBrands" class="check-box" />
                <span>{{ brand }}</span>
              </label>
            </div>
          </div>

          <!-- Condition Checkboxes -->
          <div class="sidebar-filter-block">
            <h4 class="sidebar-block-title">Condition</h4>
            <div class="checkbox-list">
              <label class="check-item">
                <input type="checkbox" value="New" v-model="selectedConditions" class="check-box" />
                <span>New</span>
              </label>
              <label class="check-item">
                <input type="checkbox" value="Fairly Used" v-model="selectedConditions" class="check-box" />
                <span>Fairly Used</span>
              </label>
            </div>
          </div>

          <!-- Sort Radio Buttons -->
          <div class="sidebar-filter-block">
            <h4 class="sidebar-block-title">Sort by</h4>
            <div class="radio-list">
              <label class="radio-item">
                <input type="radio" value="recommended" v-model="sortBy" name="sort" class="radio-dot" />
                <span>Recommended</span>
              </label>
              <label class="radio-item">
                <input type="radio" value="priceLowToHigh" v-model="sortBy" name="sort" class="radio-dot" />
                <span>Price Low to High</span>
              </label>
              <label class="radio-item">
                <input type="radio" value="priceHighToLow" v-model="sortBy" name="sort" class="radio-dot" />
                <span>Price High to Low</span>
              </label>
              <label class="radio-item">
                <input type="radio" value="newest" v-model="sortBy" name="sort" class="radio-dot" />
                <span>Newest</span>
              </label>
            </div>
          </div>
        </aside>

        <!-- Product Grid Column -->
        <main class="products-catalog-col">
          <div class="catalog-results-header">
            <span class="results-count">Showing {{ filteredProducts.length }} of {{ totalProducts }} results for <span class="active-cat-name">{{ activeCategoryTab }}</span></span>
          </div>

          <div v-if="filteredProducts.length === 0" class="empty-results-state">
            <div class="empty-icon-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <h3>No products found</h3>
            <p>Try clearing some filters or searching for something else.</p>
            <button class="btn btn-navy" @click="clearAllFilters">Clear All Filters</button>
          </div>

          <div v-else class="marketplace-sections-container animate-fade-in" :key="filteredProducts.length">
            <div v-for="section in sectionedProducts" :key="section.title" class="marketplace-section">
              <div class="marketplace-section-header">
                <h3 class="marketplace-section-title">{{ section.title }}</h3>
                <button 
                  v-if="activeCategoryTab === 'All'" 
                  class="see-all-link" 
                  @click="selectCategory(section.title)"
                >
                  See all {{ section.title }} &rarr;
                </button>
              </div>
              <div class="product-grid">
                <ProductCard v-for="prod in section.products" :key="prod.id" :product="prod" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <!-- Yellow Sticky Bottom Banner -->
    <div v-if="isStickyBannerVisible" class="sticky-ai-banner animate-fade-in">
      <div class="sticky-banner-content">
        <div class="sticky-banner-text">
          <div class="sparkle-icon-wrapper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path>
            </svg>
          </div>
          <span>Not finding what you need? Describe it to our AI.</span>
        </div>
        <div class="sticky-banner-actions">
          <router-link to="/ai-recommender" class="btn btn-navy sticky-banner-btn">Try AI Recommender</router-link>
          <button class="sticky-close-btn" @click="isStickyBannerVisible = false" aria-label="Close banner">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marketplace-header {
  background-color: var(--color-navy);
  color: var(--color-white);
  padding: 48px 0;
  margin-bottom: 40px;
}

.marketplace-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.marketplace-title {
  font-size: 36px;
  font-weight: 800;
  color: var(--color-white);
  margin-bottom: 8px;
}

.marketplace-subtitle {
  font-size: 15px;
  color: #94A3B8;
}

.ai-banner-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  border: none;
  font-weight: 700;
  font-size: 13.5px;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.ai-banner-badge:hover {
  background-color: var(--color-yellow-hover);
}

/* Controls section styling */
.controls-section {
  margin-bottom: 32px;
}

.controls-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input-box {
  position: relative;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 16px;
  top: 14px;
  color: var(--color-muted-grey);
}

.search-input-field {
  width: 100%;
  padding: 14px 16px 14px 48px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  outline: none;
  font-size: 14.5px;
  background-color: var(--color-white);
  transition: all 0.2s ease;
}

.search-input-field:focus {
  border-color: var(--color-navy);
  box-shadow: 0 0 0 3px rgba(10, 15, 41, 0.08);
}

.filter-toggle-btn {
  padding: 14px 24px;
  font-size: 14.5px;
}

/* Filter Chips */
.filter-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 20px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 13px;
  color: var(--color-slate-headings);
  font-weight: 500;
}

.chip-close-btn {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-muted-grey);
  display: flex;
  align-items: center;
}

.chip-close-btn:hover {
  color: var(--color-red);
}

.clear-all-btn {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-purple);
  cursor: pointer;
  padding: 4px 8px;
  text-decoration: underline;
}

.clear-all-btn:hover {
  color: var(--color-purple-hover);
}

/* Scroll tabs */
.category-tabs-scroll {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-light);
}

.category-tabs-scroll::-webkit-scrollbar {
  height: 4px;
}

.category-tabs-scroll::-webkit-scrollbar-thumb {
  background-color: var(--color-border-light);
  border-radius: 100px;
}

.cat-tab-link {
  background: none;
  border: none;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--color-muted-grey);
  cursor: pointer;
  padding-bottom: 12px;
  position: relative;
  white-space: nowrap;
}

.cat-tab-link.active {
  color: var(--color-navy);
}

.cat-tab-link.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: var(--color-yellow);
}

/* Catalog Body */
.catalog-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 32px;
  margin-bottom: 80px;
}

.filter-sidebar {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
  height: fit-content;
}

.sidebar-filter-block {
  margin-bottom: 28px;
}

.sidebar-filter-block:last-child {
  margin-bottom: 0;
}

.sidebar-block-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-slate-headings);
  margin-bottom: 14px;
}

/* Price double sliders */
.price-slider-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-slate-headings);
  margin-bottom: 12px;
}

.price-slider-controls {
  position: relative;
  height: 8px;
}

.range-slider {
  width: 100%;
  accent-color: var(--color-navy);
}

/* Lists */
.checkbox-list, .radio-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.check-item, .radio-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--color-slate-body);
  cursor: pointer;
}

.check-box {
  width: 16px;
  height: 16px;
  accent-color: var(--color-navy);
}

.radio-dot {
  width: 16px;
  height: 16px;
  accent-color: var(--color-navy);
}

/* Results section */
.catalog-results-header {
  margin-bottom: 20px;
}

.results-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-muted-grey);
}

.active-cat-name {
  color: var(--color-slate-headings);
  font-weight: 700;
}

.empty-results-state {
  text-align: center;
  padding: 60px 24px;
  background-color: var(--color-white);
  border-radius: 16px;
  border: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon-box {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: var(--color-bg);
  color: var(--color-muted-grey);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-results-state h3 {
  font-size: 20px;
  font-weight: 700;
}

.empty-results-state p {
  font-size: 14px;
  color: var(--color-muted-grey);
  margin-bottom: 8px;
}

/* Pagination UI */
.pagination-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 48px;
}

.pagination-nav-btn {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--color-slate-headings);
  transition: all 0.2s ease;
}

.pagination-nav-btn:hover:not(:disabled) {
  border-color: var(--color-navy);
}

.pagination-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-num-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-white);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-slate-headings);
  transition: all 0.2s ease;
}

.page-num-btn:hover {
  border-color: var(--color-navy);
}

.page-num-btn.active {
  background-color: var(--color-navy);
  border-color: var(--color-navy);
  color: var(--color-white);
}

.pagination-dots {
  color: var(--color-muted-grey);
  padding: 0 4px;
}

/* Sticky AI Banner bottom */
.sticky-ai-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  padding: 16px 24px;
  z-index: 99;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.05);
}

.sticky-banner-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.sticky-banner-text {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 14.5px;
}

.sparkle-icon-wrapper {
  width: 28px;
  height: 28px;
  background-color: rgba(10, 15, 41, 0.06);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sticky-banner-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sticky-banner-btn {
  padding: 8px 16px;
  font-size: 12.5px;
  border-radius: 6px;
}

.sticky-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-navy);
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.sticky-close-btn:hover {
  opacity: 1;
}

.marketplace-sections-container {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.marketplace-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
}

.marketplace-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--color-border-light);
  padding-bottom: 8px;
  margin-top: 12px;
}

.marketplace-section-title {
  font-family: 'Plus Jakarta Sans', var(--font-body);
  font-size: 24px;
  font-weight: 800;
  color: var(--color-slate-headings);
  margin: 0;
}

.see-all-link {
  background: none;
  border: none;
  color: #E5AD00; /* Yellow/Gold link */
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;
  font-family: var(--font-body);
  display: inline-flex;
  align-items: center;
}

.see-all-link:hover {
  color: var(--color-navy);
  text-decoration: underline;
}

/* Horizontal scrolling catalog row list on both desktop and mobile */
.marketplace-section .product-grid {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  overflow-x: auto !important;
  scroll-snap-type: x mandatory;
  gap: 20px !important;
  padding: 8px 4px 20px 4px !important;
  -webkit-overflow-scrolling: touch;
  width: 100% !important;
  scroll-behavior: smooth;
}

.marketplace-section .product-grid::-webkit-scrollbar {
  height: 6px;
}

.marketplace-section .product-grid::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
}

.marketplace-section .product-grid::-webkit-scrollbar-thumb {
  background: rgba(30, 14, 98, 0.15);
  border-radius: 10px;
}

.marketplace-section .product-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(30, 14, 98, 0.3);
}

.marketplace-section .product-grid > * {
  flex: 0 0 215px !important;
  width: 215px !important;
  max-width: 215px !important;
  scroll-snap-align: start;
}

/* Responsive catalog grids */
@media (max-width: 992px) {
  .catalog-layout {
    grid-template-columns: 1fr;
  }
  .filter-sidebar {
    display: none;
  }
}

@media (max-width: 768px) {
  /* Prevent horizontal scroll leakage and bleed on mobile */
  .marketplace-view {
    overflow-x: hidden !important;
  }
  .main-market-layout,
  .products-catalog-col,
  .marketplace-sections-container,
  .marketplace-section {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }
}
</style>
