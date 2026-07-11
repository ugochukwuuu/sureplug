<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { mockProducts } from '../mockProducts';
import { useCartStore } from '../stores/cart';
import { useFavoritesStore } from '../stores/favorites';
import ProductCard from '../components/ProductCard.vue';

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();

// UI States
const activeTab = ref('Specifications');
const activeImageIndex = ref(0);
const quantity = ref(1);
const isStickyBannerVisible = ref(true);

const product = ref(null);
const productsList = ref([]);

const verdictMatchPercentage = ref(null);
const verdictBullets = ref([]);
const verdictHandler = ref('');
const isVerdictLoading = ref(true);

const reviewsData = ref({
  reviews: [],
  totalReviewCount: 0,
  averageRating: 0
});
const isReviewsLoading = ref(false);
const reportedReviews = ref(new Set());

const loadReviews = async () => {
  const id = Number(route.params.id);
  isReviewsLoading.value = true;
  try {
    const res = await fetch(`/api/products/${id}/reviews`);
    if (res.ok) {
      reviewsData.value = await res.json();
    }
  } catch (e) {
    console.error('Error fetching product reviews:', e);
  } finally {
    isReviewsLoading.value = false;
  }
};

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;

  return past.toLocaleDateString('en-NG', { dateStyle: 'medium' });
};

const reportReview = async (reviewId) => {
  try {
    const res = await fetch(`/api/reviews/${reviewId}/report`, {
      method: 'POST'
    });
    if (res.ok) {
      reportedReviews.value.add(reviewId);
    } else {
      alert('Failed to report review.');
    }
  } catch (e) {
    console.error('Error reporting review:', e);
  }
};

const ratingDistribution = computed(() => {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  if (reviewsData.value && Array.isArray(reviewsData.value.reviews)) {
    reviewsData.value.reviews.forEach(r => {
      if (counts[r.rating] !== undefined) {
        counts[r.rating]++;
      }
    });
  }

  const total = reviewsData.value.totalReviewCount || 1;
  const pct = {};
  for (let s = 1; s <= 5; s++) {
    pct[s] = Math.round((counts[s] / total) * 100);
  }
  return pct;
});

const fetchVerdict = async (prod) => {
  if (!prod) return;
  isVerdictLoading.value = true;
  
  const specs = typeof prod.specifications === 'string'
    ? prod.specifications
    : JSON.stringify(prod.specifications || {});

  const useCases = Array.isArray(prod.useCases) ? prod.useCases.join(', ') : '';

  const message = `How well does the ${prod.title} (${prod.brand} ${prod.category}) suit a Nigerian university student for general academic use? It is priced at ₦${prod.price.toLocaleString()} in ${prod.condition} condition. Key specs: ${specs}. Key use cases: ${useCases}.`;

  try {
    const res = await fetch('/api/ai/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        history: []
      })
    });

    if (res.ok) {
      const data = await res.json();
      const firstRec = data.recommendations?.[0];
      if (firstRec) {
        verdictMatchPercentage.value = firstRec.matchPercentage;
        verdictBullets.value = firstRec.bulletPoints || [];
      } else {
        verdictMatchPercentage.value = 85;
        verdictBullets.value = [
          'Excellent choice for student workload tasks.',
          'Durable specs with reliable campus performance.'
        ];
      }
      verdictHandler.value = data.handler || 'offline';
    } else {
      throw new Error('Verdict fetch failed');
    }
  } catch (e) {
    console.error('Error fetching AI Verdict:', e);
    verdictMatchPercentage.value = prod.condition === 'New' ? 90 : 85;
    verdictBullets.value = [
      'Reliable processing speed to run all your required academic software.',
      'Durable and suitable for general student workloads.'
    ];
    verdictHandler.value = 'offline';
  } finally {
    // Add brief artificial delay (800ms) for high quality visual skeleton loading transition
    await new Promise(resolve => setTimeout(resolve, 800));
    isVerdictLoading.value = false;
  }
};

const loadProduct = async () => {
  const id = Number(route.params.id);
  try {
    const res = await fetch(`/api/products/${id}`);
    if (res.ok) {
      product.value = await res.json();
      activeImageIndex.value = 0;
      quantity.value = 1;
      fetchVerdict(product.value);
    } else {
      throw new Error('Product not found in backend');
    }
  } catch (e) {
    console.error('Error fetching product detail:', e);
    const found = mockProducts.find(p => p.id === id);
    if (found) {
      product.value = found;
      activeImageIndex.value = 0;
      quantity.value = 1;
      fetchVerdict(product.value);
    } else {
      product.value = mockProducts[0];
      fetchVerdict(product.value);
    }
  }
};

const fetchAllProducts = async () => {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      productsList.value = await res.json();
    }
  } catch (e) {
    console.error('Error fetching related products:', e);
    productsList.value = mockProducts;
  }
};

onMounted(() => {
  loadProduct();
  fetchAllProducts();
  loadReviews();
});

watch(() => route.params.id, () => {
  loadProduct();
  loadReviews();
});

// Related products matches
const relatedProducts = computed(() => {
  if (!product.value) return [];
  const list = productsList.value.length > 0 ? productsList.value : mockProducts;
  return list
    .filter(p => p.id !== product.value.id && p.category === product.value.category)
    .slice(0, 5);
});

// Parse specifications JSON string
const specObject = computed(() => {
  if (!product.value?.specifications) return {};
  try {
    return JSON.parse(product.value.specifications);
  } catch (e) {
    return {};
  }
});

const getImagesArray = computed(() => {
  if (!product.value?.images) return [];
  if (Array.isArray(product.value.images)) return product.value.images;
  try {
    return JSON.parse(product.value.images);
  } catch (e) {
    return [product.value.images];
  }
});

const handleQuantityChange = (change) => {
  const newVal = quantity.value + change;
  if (newVal >= 1 && newVal <= 10) {
    quantity.value = newVal;
  }
};

const handleAddToCart = () => {
  if (product.value) {
    cartStore.addToCart(product.value, quantity.value);
  }
};

const handleBuyNow = () => {
  if (product.value) {
    cartStore.addToCart(product.value, quantity.value);
    router.push('/checkout');
  }
};

const askAI = () => {
  router.push({
    path: '/ai-recommender',
    query: { q: `Tell me about ${product.value.title}` }
  });
};

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};
</script>

<template>
  <div v-if="product" class="detail-view page-wrapper">
    <!-- Breadcrumbs -->
    <nav class="breadcrumbs">
      <router-link to="/">Home</router-link>
      <span class="crumb-separator">/</span>
      <router-link to="/marketplace">Marketplace</router-link>
      <span class="crumb-separator">/</span>
      <router-link :to="`/marketplace?category=${product.category.toLowerCase()}`">{{ product.category }}</router-link>
      <span class="crumb-separator">/</span>
      <span class="crumb-active">{{ product.title }}</span>
    </nav>

    <!-- Product Intro Layout -->
    <div class="product-intro-grid">
      <!-- Left Column: Gallery -->
      <div class="product-gallery">
        <div class="main-image-box">
          <img :src="getImagesArray[activeImageIndex]" :alt="product.title" class="gallery-main-img" />
        </div>
        
        <!-- Thumbnails -->
        <div v-if="getImagesArray.length > 1" class="thumbnail-list">
          <button 
            v-for="(img, idx) in getImagesArray" 
            :key="idx" 
            class="thumb-btn"
            :class="{ active: activeImageIndex === idx }"
            @click="activeImageIndex = idx"
          >
            <img :src="img" alt="Product thumbnail" />
          </button>
        </div>

        <div class="authentic-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>100% Authentic. Verified.</span>
        </div>
      </div>

      <!-- Right Column: Specs & purchase actions -->
      <div class="product-purchase-details">
        <div class="header-badges">
          <span class="badge badge-category">{{ product.category }}</span>
          <span class="badge badge-new">{{ product.condition }}</span>
        </div>

        <div class="product-title-row">
          <h1 class="product-title">{{ product.title }}</h1>
          <button 
            class="detail-wishlist-btn" 
            :class="{ active: favoritesStore.isFavorite(product.id) }" 
            @click="favoritesStore.toggleFavorite(product.id)"
            aria-label="Toggle Favorites"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" :fill="favoritesStore.isFavorite(product.id) ? '#E5AD00' : 'none'" :stroke="favoritesStore.isFavorite(product.id) ? '#E5AD00' : 'currentColor'" stroke-width="2.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        </div>
        
        <!-- Ratings header -->
        <div class="product-ratings-summary">
          <div class="stars-gold-custom">
            <span v-for="star in 5" :key="star" class="star-item" :style="{ color: star <= Math.round(reviewsData.averageRating) ? '#FFB800' : '#CBD5E1' }">★</span>
          </div>
          <span class="rating-num">{{ reviewsData.averageRating }}</span>
          <span class="reviews-count-text">({{ reviewsData.totalReviewCount }} reviews)</span>
        </div>

        <!-- Price -->
        <div class="product-price-highlight">{{ formatPrice(product.price) }}</div>

        <!-- Unavailability Notice -->
        <div v-if="product.is_available === false" class="unavailability-notice animate-fade-in">
          ⚠️ This product is currently sold out and unavailable.
        </div>

        <p class="product-description-text">{{ product.description }}</p>

        <!-- Buy actions -->
        <div class="purchase-controls">
          <div class="qty-select-wrapper">
            <span class="qty-label">Quantity</span>
            <div class="qty-selector">
              <button class="qty-btn" @click="handleQuantityChange(-1)">−</button>
              <span class="qty-count">{{ quantity }}</span>
              <button class="qty-btn" @click="handleQuantityChange(1)">+</button>
            </div>
          </div>

          <div class="action-buttons-row">
            <button 
              class="btn btn-navy cart-submit-btn" 
              :class="{ 'btn-disabled': product.is_available === false }"
              :disabled="product.is_available === false"
              @click="handleAddToCart"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Add to Cart
            </button>
            <button 
              class="btn btn-yellow buy-now-btn" 
              :class="{ 'btn-disabled': product.is_available === false }"
              :disabled="product.is_available === false"
              @click="handleBuyNow"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Buy Now
            </button>
          </div>
        </div>

        <!-- Trust Row badges -->
        <div class="detail-trust-row">
          <div class="detail-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>Verified Product</span>
          </div>
          <div class="detail-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon></svg>
            <span>1-2 Day Delivery</span>
          </div>
          <div class="detail-trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>7-Day Returns</span>
          </div>
        </div>

      </div>
    </div>

    <!-- Product Tabs Navigation -->
    <section class="detail-tabs-section">
      <div class="tabs-nav-bar">
        <button 
          v-for="tab in ['Specifications', 'Description', 'Reviews']" 
          :key="tab"
          class="tab-link-btn"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Specs Content -->
      <div v-if="activeTab === 'Specifications'" class="tab-content-panel specs-panel animate-fade-in">
        <table class="specs-table">
          <tbody>
            <tr v-for="(val, key) in specObject" :key="key" class="spec-table-row">
              <td class="spec-key">{{ key }}</td>
              <td class="spec-value">{{ val }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Description Content -->
      <div v-else-if="activeTab === 'Description'" class="tab-content-panel desc-panel animate-fade-in">
        <h3 class="panel-subtitle">Product Description</h3>
        <p class="panel-paragraph">{{ product.description }}</p>
        <p class="panel-paragraph">Perfect companion for university students, packing enough battery longevity and hardware capabilities to support heavy academic tasks, coding compilers, and digital designs.</p>
      </div>

      <!-- Reviews Content -->
      <div v-else-if="activeTab === 'Reviews'" class="tab-content-panel reviews-panel animate-fade-in">
        <div class="reviews-split-grid">
          <!-- Left metrics -->
          <div class="reviews-aggregate-box">
            <div class="agg-num">{{ reviewsData.averageRating }}</div>
            <p class="agg-lbl">out of 5</p>
            <div class="stars-gold-custom inline-stars">
              <span v-for="star in 5" :key="star" :style="{ color: star <= Math.round(reviewsData.averageRating) ? '#FFB800' : '#CBD5E1' }">★</span>
            </div>
            <span class="agg-count-text">{{ reviewsData.totalReviewCount }} reviews</span>

            <!-- Rating bars list -->
            <div class="rating-bar-chart">
              <div class="rating-row" v-for="star in [5, 4, 3, 2, 1]" :key="star">
                <span class="star-lbl">{{ star }}★</span>
                <div class="progress-bar-bg">
                  <div class="progress-fill" :style="{ width: `${ratingDistribution[star]}%` }"></div>
                </div>
                <span class="percent-val">{{ ratingDistribution[star] }}%</span>
              </div>
            </div>
          </div>

          <!-- Right reviews list -->
          <div class="reviews-comments-list">
            <!-- Loading Indicator -->
            <div v-if="isReviewsLoading" class="reviews-loading-inline">
              <span class="spinner-small"></span> Loading reviews...
            </div>

            <!-- Empty State -->
            <div v-else-if="reviewsData.reviews.length === 0" class="reviews-empty-state">
              <p class="empty-title">No reviews yet. Be the first to share your experience.</p>
              <p class="empty-note">Only verified buyers who purchased this device can submit reviews.</p>
            </div>

            <!-- Review items -->
            <div v-else v-for="rev in reviewsData.reviews" :key="rev.id" class="review-comment-card animate-fade-in">
              <div class="reviewer-header">
                <div class="reviewer-avatar-placeholder">
                  {{ (rev.reviewer_name || 'U').charAt(0).toUpperCase() }}
                </div>
                <div class="reviewer-meta">
                  <div class="reviewer-name-row">
                    <span class="reviewer-name">{{ rev.reviewer_name }}</span>
                    <span class="verified-badge">✓ Verified Buyer</span>
                  </div>
                  <span class="reviewer-school" v-if="rev.reviewer_university">{{ rev.reviewer_university }}</span>
                </div>
                <div class="review-stars-col">
                  <div class="star-rating-display">
                    <span v-for="star in 5" :key="star" :style="{ color: star <= rev.rating ? '#FFB800' : '#CBD5E1' }">★</span>
                  </div>
                  <span class="review-date">{{ formatRelativeDate(rev.created_at) }}</span>
                </div>
              </div>
              <p class="review-text-body">{{ rev.comment }}</p>

              <!-- Report Link Row -->
              <div class="review-actions-row">
                <span v-if="reportedReviews.has(rev.id)" class="reported-confirmation">
                  ✓ Thanks for reporting
                </span>
                <button v-else @click="reportReview(rev.id)" class="report-review-btn">
                  Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>

    <!-- Related Products Carousel -->
    <section class="related-listings-section section-container">
      <h2 class="section-title">You might also like</h2>
      <div class="product-grid related-grid">
        <ProductCard v-for="rp in relatedProducts" :key="rp.id" :product="rp" />
      </div>
    </section>

    <!-- Sticky Bottom Banner -->
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
.detail-view {
  margin-top: 32px;
}

/* Breadcrumbs */
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--color-muted-grey);
  margin-bottom: 32px;
  font-weight: 500;
}

.breadcrumbs a:hover {
  color: var(--color-navy);
  text-decoration: underline;
}

.crumb-separator {
  opacity: 0.5;
}

.crumb-active {
  color: var(--color-slate-headings);
  font-weight: 600;
}

/* Intro Grid */
.product-intro-grid {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 48px;
  margin-bottom: 60px;
}

/* Gallery */
.product-gallery {
  display: flex;
  flex-direction: column;
}

.main-image-box {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.gallery-main-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.thumbnail-list {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.thumb-btn {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-white);
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.thumb-btn img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.thumb-btn.active {
  border-color: var(--color-purple);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.authentic-banner {
  background-color: #FFF9E6;
  border: 1px solid #FFEBB3;
  color: #B38600;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 24px;
}

/* Purchase details panel */
.product-purchase-details {
  display: flex;
  flex-direction: column;
}

.header-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.product-title {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.25;
  color: var(--color-slate-headings);
  margin-bottom: 12px;
}

.product-ratings-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 14px;
}

.stars-gold {
  color: var(--color-gold);
}

.rating-num {
  font-weight: 700;
  color: var(--color-slate-headings);
}

.reviews-count-text {
  color: var(--color-muted-grey);
}

.product-price-highlight {
  font-family: var(--font-headings);
  font-size: 36px;
  font-weight: 800;
  color: var(--color-yellow);
  margin-bottom: 24px;
}

.product-description-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-slate-body);
  margin-bottom: 32px;
}

/* Quantity and checkout buttons */
.purchase-controls {
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  padding: 24px 0;
  margin-bottom: 24px;
}

.qty-select-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.qty-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-slate-headings);
}

.qty-selector {
  display: inline-flex;
  align-items: center;
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  overflow: hidden;
}

.qty-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-slate-body);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-btn:hover {
  background-color: var(--color-bg);
}

.qty-count {
  width: 44px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-slate-headings);
}

.action-buttons-row {
  display: flex;
  gap: 16px;
}

.cart-submit-btn {
  flex: 1.2;
  padding: 14px 24px;
}

.buy-now-btn {
  flex: 1;
  padding: 14px 24px;
}

/* Detail Trust */
.detail-trust-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.detail-trust-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-slate-headings);
}

.ask-ai-link-row {
  font-size: 14px;
}

.ask-ai-text-link {
  background: none;
  border: none;
  font-weight: 700;
  color: var(--color-purple);
  text-decoration: underline;
  cursor: pointer;
}

.ask-ai-text-link:hover {
  color: var(--color-purple-hover);
}

/* Tabs UI styling */
.detail-tabs-section {
  margin-top: 60px;
  margin-bottom: 40px;
}

.tabs-nav-bar {
  display: flex;
  gap: 32px;
  border-bottom: 2px solid var(--color-border-light);
  margin-bottom: 24px;
}

.tab-link-btn {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-muted-grey);
  cursor: pointer;
  padding-bottom: 16px;
  position: relative;
  font-family: var(--font-headings);
}

.tab-link-btn.active {
  color: var(--color-navy);
}

.tab-link-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: var(--color-yellow);
}

.tab-content-panel {
  padding: 8px 0;
}

/* Specs layout */
.specs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14.5px;
}

.specs-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.spec-table-row:nth-child(even) {
  background-color: #F8FAFC;
}

.spec-key {
  font-weight: 600;
  color: var(--color-slate-headings);
  width: 250px;
}

.spec-value {
  color: var(--color-slate-body);
}

/* Description Panel */
.panel-subtitle {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}

.panel-paragraph {
  line-height: 1.6;
  color: var(--color-slate-body);
  margin-bottom: 16px;
}

/* Reviews Panel */
.reviews-split-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 48px;
}

.reviews-aggregate-box {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.agg-num {
  font-family: var(--font-headings);
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  color: var(--color-slate-headings);
}

.agg-lbl {
  font-size: 13px;
  color: var(--color-muted-grey);
  margin-bottom: 6px;
}

.inline-stars {
  font-size: 18px;
  margin-bottom: 4px;
}

.agg-count-text {
  font-size: 13px;
  color: var(--color-muted-grey);
  margin-bottom: 24px;
}

.rating-bar-chart {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
}

.star-lbl {
  width: 24px;
}

.progress-bar-bg {
  flex: 1;
  height: 6px;
  background-color: var(--color-bg);
  border-radius: 100px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-gold);
  border-radius: 100px;
}

.percent-val {
  width: 28px;
  text-align: right;
  color: var(--color-muted-grey);
}

/* Reviews List */
.reviews-comments-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-comment-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 20px;
}

.reviewer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.reviewer-avatar-img {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-bg);
}

.reviewer-avatar-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reviewer-meta {
  flex-grow: 1;
}

.reviewer-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.reviewer-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--color-slate-headings);
}

.blue-check {
  font-size: 11px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #3B82F6;
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
}

.reviewer-school {
  font-size: 12px;
  color: var(--color-muted-grey);
}

.review-stars-col {
  text-align: right;
}

.review-date {
  font-size: 11px;
  color: var(--color-muted-grey);
}

.review-text-body {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-slate-body);
}

/* Carousel/Grid tweaks */
.related-grid {
  margin-top: 24px;
}

.sticky-ai-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  padding: 16px 24px;
  z-index: 99;
}

.sticky-banner-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
}

@media (max-width: 992px) {
  .product-intro-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .main-image-box {
    height: 300px;
  }
}

@media (max-width: 768px) {
  /* Fix 2: Safety overflow prevention */
  .detail-view {
    overflow-x: hidden;
  }

  /* Fix 4: Full viewport width product image */
  .product-gallery {
    margin-left: -24px !important;
    margin-right: -24px !important;
    width: calc(100% + 48px) !important;
  }
  .main-image-box {
    height: 360px !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    background-color: var(--color-bg) !important;
    padding: 24px !important;
  }
  .gallery-main-img {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
  }
  .thumbnail-list {
    padding: 0 24px !important;
  }
  .authentic-banner {
    margin-left: 24px !important;
    margin-right: 24px !important;
  }

  /* Fix 3: Brand Identity treatments */
  .product-title {
    font-family: var(--font-display) !important;
    font-size: 32px !important;
    line-height: 1.2 !important;
    font-weight: normal !important;
  }
  
  .product-price-highlight {
    color: var(--color-yellow) !important;
    font-size: 30px !important;
    font-weight: 800 !important;
  }

  /* Deep Indigo background section for the trust signals row */
  .detail-trust-row {
    background-color: var(--color-navy) !important;
    color: var(--color-white) !important;
    padding: 20px !important;
    border-radius: 12px !important;
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 14px !important;
    margin-bottom: 24px !important;
    box-shadow: 0 4px 15px rgba(30, 14, 98, 0.1);
  }
  .detail-trust-item {
    color: var(--color-white) !important;
    font-weight: 600 !important;
  }
  .detail-trust-item svg {
    stroke: var(--color-yellow) !important;
  }

  /* Full-width thumb-friendly buttons */
  .action-buttons-row {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    width: 100% !important;
  }
  .cart-submit-btn, .buy-now-btn {
    width: 100% !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    padding: 16px 24px !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    border-radius: 10px !important;
  }
  .cart-submit-btn {
    background-color: var(--color-navy) !important;
    color: var(--color-white) !important;
    border: none !important;
  }
  .buy-now-btn {
    background-color: var(--color-yellow) !important;
    color: var(--color-navy) !important;
    border: none !important;
  }

  /* Correct brand yellow styles for the sticky AI banner */
  .sticky-ai-banner {
    background-color: var(--color-yellow) !important;
    border-top: 1.5px solid var(--color-navy-hover) !important;
    box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.1) !important;
    padding: 12px 16px !important;
  }
  .sticky-banner-content {
    flex-direction: column !important;
    gap: 10px !important;
    text-align: center !important;
    align-items: stretch !important;
  }
  .sticky-banner-text {
    justify-content: center !important;
    font-size: 13px !important;
  }
  .sticky-banner-actions {
    justify-content: center !important;
    width: 100% !important;
  }
  .sticky-banner-btn {
    flex: 1 !important;
    text-align: center !important;
    font-weight: 700 !important;
  }

  /* Fix 2: Prevent tab bar overflow */
  .tabs-nav-bar {
    overflow-x: auto !important;
    gap: 16px !important;
    padding-bottom: 8px !important;
    -webkit-overflow-scrolling: touch;
  }
  .tab-link-btn {
    font-size: 14px !important;
    white-space: nowrap !important;
    padding-bottom: 8px !important;
  }

  /* Reviews grid */
  .reviews-split-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  /* Fix 1: Horizontal scroll strip for related products */
  .related-grid {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    scroll-snap-type: x mandatory;
    gap: 16px !important;
    padding: 8px 4px 16px 4px !important;
    -webkit-overflow-scrolling: touch;
    width: 100% !important;
  }
  .related-grid > * {
    flex: 0 0 250px !important;
    width: 250px !important;
    max-width: 250px !important;
    scroll-snap-align: start;
  }
}

.product-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.detail-wishlist-btn {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted-grey);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.detail-wishlist-btn:hover {
  border-color: #FCD34D;
  background-color: #FEF3C7;
  color: #E5AD00;
}

.detail-wishlist-btn.active {
  background-color: #FEF3C7 !important;
  border-color: #FCD34D !important;
  color: #E5AD00 !important;
}

.detail-wishlist-btn svg {
  transition: transform 0.2s ease, fill 0.2s ease, stroke 0.2s ease;
}

.detail-wishlist-btn:active svg {
  transform: scale(1.3);
}

.unavailability-notice {
  background-color: #FEF2F2;
  border-left: 4px solid #EF4444;
  color: #B91C1C;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0;
  text-align: left;
}

.btn-disabled {
  background-color: #E2E8F0 !important;
  border-color: #E2E8F0 !important;
  color: #94A3B8 !important;
  cursor: not-allowed !important;
  opacity: 0.7;
}

/* Custom review styles */
.stars-gold-custom {
  font-size: 18px;
  display: flex;
  gap: 2px;
}
.stars-gold-custom .star-item {
  color: #CBD5E1;
}
.inline-stars {
  justify-content: center;
  margin-bottom: 8px;
}
.reviewer-avatar-placeholder {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: var(--color-navy);
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
}
.verified-badge {
  background-color: #ECFDF5;
  color: #059669;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  margin-left: 8px;
}
.review-actions-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  border-top: 1px dashed var(--color-border-light);
  padding-top: 8px;
}
.report-review-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--color-muted-grey);
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
}
.report-review-btn:hover {
  color: #EF4444;
}
.reported-confirmation {
  font-size: 12px;
  color: #059669;
  font-weight: 600;
}
.reviews-loading-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--color-muted-grey);
  font-size: 14.5px;
}
.spinner-small {
  width: 18px;
  height: 18px;
  border: 2.5px solid var(--color-border-light);
  border-top-color: var(--color-navy);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.reviews-empty-state {
  text-align: center;
  padding: 48px 24px;
  background-color: var(--color-bg);
  border-radius: 16px;
  border: 1px dashed var(--color-border-light);
}
.reviews-empty-state .empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-slate-headings);
  margin-bottom: 6px;
}
.reviews-empty-state .empty-note {
  font-size: 13px;
  color: var(--color-muted-grey);
}
</style>
