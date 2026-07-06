<script setup>
import { ref, onMounted, computed } from 'vue';
import { useFavoritesStore } from '../stores/favorites';
import ProductCard from '../components/ProductCard.vue';

const favoritesStore = useFavoritesStore();
const products = ref([]);
const isLoading = ref(true);

const loadProducts = async () => {
  isLoading.value = true;
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      products.value = await res.json();
    }
  } catch (e) {
    console.error('Failed to load products for favorites list:', e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadProducts();
});

// Filter matching favorited products
const favoritedItems = computed(() => {
  return products.value.filter(p => favoritesStore.favorites.includes(Number(p.id)));
});
</script>

<template>
  <div class="favorites-view page-wrapper">
    <header class="favorites-header">
      <h1 class="favorites-title">My Saved Devices</h1>
      <p class="favorites-subtitle">
        Your personally curated collection of verified gadgets.
      </p>
    </header>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading your saved devices...</p>
    </div>

    <div v-else>
      <div v-if="favoritedItems.length > 0" class="favorites-grid animate-fade-in">
        <ProductCard 
          v-for="item in favoritedItems" 
          :key="item.id" 
          :product="item" 
        />
      </div>

      <!-- Empty State -->
      <div v-else class="empty-favorites-state animate-fade-in">
        <div class="heart-icon-box">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>
        <h3>No saved gadgets yet</h3>
        <p>Start hearting items in the marketplace to build your wishlist!</p>
        <router-link to="/marketplace" class="btn btn-navy">Browse Marketplace</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.favorites-view {
  min-height: calc(100vh - 200px);
  padding-top: 56px;
  padding-bottom: 80px;
}

.favorites-header {
  margin-bottom: 40px;
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 20px;
}

.favorites-title {
  font-family: var(--font-headings);
  font-size: 32px;
  font-weight: 800;
  color: var(--color-navy);
  margin-bottom: 8px;
}

.favorites-subtitle {
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--color-muted-grey);
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 32px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--color-muted-grey);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border-light);
  border-top-color: var(--color-purple);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.empty-favorites-state {
  text-align: center;
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 24px;
  padding: 60px 40px;
  max-width: 500px;
  margin: 40px auto 0 auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

.heart-icon-box {
  background-color: #FFF2F2;
  color: #FF5A5A;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px auto;
}

.empty-favorites-state h3 {
  font-family: var(--font-headings);
  font-size: 20px;
  color: var(--color-navy);
  margin-bottom: 8px;
}

.empty-favorites-state p {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-muted-grey);
  margin-bottom: 24px;
  line-height: 1.5;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 576px) {
  .favorites-title {
    font-size: 26px;
  }
  .favorites-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
