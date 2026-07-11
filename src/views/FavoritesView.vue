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

      <!-- Empty State (Styled Empty State) -->
      <div v-else class="empty-favorites-state animate-fade-in">
        <h2 class="empty-headline">Nothing saved yet.</h2>
        <p class="empty-subtext">Tap the heart on any product to save it here.</p>
        <router-link to="/marketplace" class="btn btn-yellow">Browse Marketplace</router-link>
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
  border-radius: var(--radius-card);
  padding: 60px 24px;
  max-width: 500px;
  margin: 40px auto 0 auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-headline {
  font-family: var(--font-display), serif;
  font-size: 2.25rem;
  color: var(--color-navy);
  margin: 0;
}

.empty-subtext {
  font-family: var(--font-body), sans-serif;
  font-size: 1rem;
  color: var(--color-muted-grey);
  max-width: 400px;
  margin: 0;
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
