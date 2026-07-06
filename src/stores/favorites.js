import { defineStore } from 'pinia';

export const useFavoritesStore = defineStore('favorites', {
  state: () => {
    let savedFavorites = [];
    try {
      const stored = localStorage.getItem('sureplug_favorites');
      if (stored) {
        savedFavorites = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse saved favorites from localStorage:', e);
    }
    return {
      favorites: savedFavorites // Array of product IDs (numbers)
    };
  },
  actions: {
    addFavorite(productId) {
      const id = Number(productId);
      if (!this.favorites.includes(id)) {
        this.favorites.push(id);
        localStorage.setItem('sureplug_favorites', JSON.stringify(this.favorites));
      }
    },
    removeFavorite(productId) {
      const id = Number(productId);
      this.favorites = this.favorites.filter(favId => favId !== id);
      localStorage.setItem('sureplug_favorites', JSON.stringify(this.favorites));
    },
    toggleFavorite(productId) {
      const id = Number(productId);
      if (this.favorites.includes(id)) {
        this.removeFavorite(id);
      } else {
        this.addFavorite(id);
      }
    },
    isFavorite(productId) {
      const id = Number(productId);
      return this.favorites.includes(id);
    }
  }
});
