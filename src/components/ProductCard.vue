<script setup>
import { useCartStore } from '../stores/cart';
import { useFavoritesStore } from '../stores/favorites';
import { useRouter } from 'vue-router';

const props = defineProps({
  product: {
    type: Object,
    required: true
  }
});

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const router = useRouter();

const toggleWishlist = (e) => {
  e.stopPropagation();
  favoritesStore.toggleFavorite(props.product.id);
};

const handleAddToCart = (e) => {
  e.stopPropagation();
  cartStore.addToCart(props.product, 1);
};

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

const navigateToDetail = () => {
  router.push(`/product/${props.product.id}`);
};

const getImageUrl = (images) => {
  if (Array.isArray(images)) return images[0] || '';
  try {
    const parsed = JSON.parse(images || '[]');
    return parsed[0] || '';
  } catch (e) {
    return images || '';
  }
};
</script>

<template>
  <div class="product-card" @click="navigateToDetail">
    <!-- Wishlist Heart Overlay -->
    <button class="product-card-wishlist" :class="{ active: favoritesStore.isFavorite(product.id) }" @click="toggleWishlist" aria-label="Toggle Wishlist">
      <svg width="18" height="18" viewBox="0 0 24 24" :fill="favoritesStore.isFavorite(product.id) ? '#E5AD00' : 'none'" :stroke="favoritesStore.isFavorite(product.id) ? '#E5AD00' : 'currentColor'" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    </button>

    <!-- Image Wrapper for equal padding and scaling fit -->
    <div class="product-card-img-wrapper">
      <img :src="getImageUrl(product.images)" :alt="product.title" class="product-card-image" loading="lazy" />
    </div>

    <!-- Details -->
    <div class="product-card-details">
      <div class="product-card-badge-row">
        <span class="badge badge-category">{{ product.category }}</span>
        <span class="badge" :class="product.condition === 'New' ? 'badge-new' : 'badge-used'">
          {{ product.condition }}
        </span>
        <span v-if="product.is_available === false" class="badge badge-unavailable">
          Currently Unavailable
        </span>
      </div>
      
      <h3 class="product-card-title">{{ product.title }}</h3>
      <p class="product-card-desc">{{ product.description || 'Verified authentic device' }}</p>
      
      <div class="product-card-footer">
        <div class="product-card-price">{{ formatPrice(product.price) }}</div>
        
        <button 
          class="btn btn-navy product-card-btn" 
          :class="{ 'btn-disabled': product.is_available === false }"
          :disabled="product.is_available === false"
          @click="handleAddToCart"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          Add to Cart
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  cursor: pointer;
}

.product-card-details {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.product-card-wishlist.active {
  background-color: #FEF3C7 !important;
  border-color: #FCD34D !important;
}

.product-card-wishlist svg {
  transition: transform 0.2s ease, fill 0.2s ease, stroke 0.2s ease;
}

.product-card-wishlist:active svg {
  transform: scale(1.3);
}

.product-card-footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: auto;
  gap: 10px;
}

.product-card-price {
  font-family: var(--font-headings);
  font-size: 18px;
  font-weight: 800;
  color: var(--color-slate-headings);
  margin: 0;
}

.product-card-btn {
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
  border-radius: var(--radius-button);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.badge-unavailable {
  background-color: var(--color-bg) !important;
  color: var(--color-muted-grey) !important;
  border: 1px solid var(--color-border-light) !important;
  opacity: 0.85;
}

.btn-disabled {
  background-color: #E2E8F0 !important;
  border-color: #E2E8F0 !important;
  color: #94A3B8 !important;
  cursor: not-allowed !important;
  opacity: 0.7;
}
</style>
