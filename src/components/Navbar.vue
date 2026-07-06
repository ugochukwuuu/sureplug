<script setup>
import { ref } from 'vue';
import { useCartStore } from '../stores/cart';
import { useFavoritesStore } from '../stores/favorites';
import { useRouter } from 'vue-router';

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const router = useRouter();
const isMenuOpen = ref(false);
</script>

<template>
  <nav class="navbar">
    <div class="navbar-content">
      <!-- Logo -->
      <router-link to="/" class="navbar-logo">
        <img src="../assets/logo.png" alt="Sureplug Logo" class="logo-image" />
        <span class="logo-text">Sureplug</span>
      </router-link>

      <!-- Nav Links (Desktop) -->
      <div class="navbar-links">
        <router-link to="/marketplace" class="nav-link" active-class="active">Marketplace</router-link>
        <router-link to="/ai-recommender" class="nav-link" active-class="active">AI Recommender</router-link>
        <router-link to="/sell-your-device" class="nav-link" active-class="active">Sell Your Device</router-link>
        <a href="#" class="nav-link">Help</a>
      </div>

      <!-- Action Items (Desktop) -->
      <div class="navbar-actions">
        <!-- Favorites Icon -->
        <router-link to="/favorites" class="wishlist-btn" title="My Saved Devices">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span v-if="favoritesStore.favorites.length > 0" class="wishlist-badge">{{ favoritesStore.favorites.length }}</span>
        </router-link>

        <!-- Cart Icon -->
        <router-link to="/checkout" class="cart-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span v-if="cartStore.cartCount > 0" class="cart-badge">{{ cartStore.cartCount }}</span>
        </router-link>
      </div>

      <!-- Hamburger Menu Toggle Button (Mobile) -->
      <button class="menu-toggle-btn" @click="isMenuOpen = !isMenuOpen" :class="{ 'is-open': isMenuOpen }" aria-label="Toggle Navigation Menu">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
    </div>

    <!-- Mobile Dropdown Menu -->
    <div v-if="isMenuOpen" class="mobile-menu-dropdown">
      <router-link to="/marketplace" class="mobile-nav-link" @click="isMenuOpen = false">Marketplace</router-link>
      <router-link to="/ai-recommender" class="mobile-nav-link" @click="isMenuOpen = false">AI Recommender</router-link>
      <router-link to="/sell-your-device" class="mobile-nav-link" active-class="active" @click="isMenuOpen = false">Sell Your Device</router-link>
      <a href="#" class="mobile-nav-link" @click="isMenuOpen = false">Help</a>
      
      <div class="mobile-menu-divider"></div>
      
      <!-- Cart and Profile Actions on Mobile -->
      <router-link to="/favorites" class="mobile-cart-link" @click="isMenuOpen = false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <span>Favorites ({{ favoritesStore.favorites.length }})</span>
      </router-link>

      <router-link to="/checkout" class="mobile-cart-link" @click="isMenuOpen = false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <span>Shopping Cart ({{ cartStore.cartCount }})</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  background-color: var(--color-navy);
  color: var(--color-white);
  height: 72px;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.navbar-content {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: 5px;
}

.logo-image {
  height: 38px;
  width: auto;
  object-fit: contain;
  display: block;
}

.logo-text {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--color-white);
  letter-spacing: 0.02em;
}

.navbar-links {
  display: flex;
  gap: 32px;
}

.nav-link {
  font-size: 14px;
  font-weight: 600;
  color: #94A3B8;
  transition: all 0.2s ease;
}

.nav-link:hover, .nav-link.active {
  color: var(--color-yellow);
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.cart-btn {
  position: relative;
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: color 0.2s ease;
}

.cart-btn:hover {
  color: var(--color-yellow);
}

.cart-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.wishlist-btn {
  position: relative;
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: color 0.2s ease;
}

.wishlist-btn:hover {
  color: var(--color-yellow);
}

.wishlist-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  transition: border-color 0.2s ease;
}

.user-avatar:hover {
  border-color: var(--color-yellow);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Hamburger menu button (Mobile) */
.menu-toggle-btn {
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 22px;
  height: 16px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 110;
}

.menu-toggle-btn .bar {
  width: 100%;
  height: 2px;
  background-color: var(--color-white);
  transition: all 0.3s ease;
  border-radius: 2px;
}

.menu-toggle-btn.is-open .bar:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.menu-toggle-btn.is-open .bar:nth-child(2) {
  opacity: 0;
}

.menu-toggle-btn.is-open .bar:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* Mobile Dropdown */
.mobile-menu-dropdown {
  position: absolute;
  top: 72px;
  left: 0;
  width: 100%;
  background-color: var(--color-navy);
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 99;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.25);
  animation: slideDown 0.25s ease-out;
}

@keyframes slideDown {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.mobile-nav-link {
  font-size: 15px;
  font-weight: 600;
  color: #94A3B8;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: color 0.2s ease;
}

.mobile-nav-link:hover, .mobile-nav-link.active {
  color: var(--color-yellow);
}

.mobile-menu-divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}

.mobile-cart-link {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-white);
  font-size: 15px;
  font-weight: 700;
  padding: 8px 0;
}

.mobile-cart-link:hover {
  color: var(--color-yellow);
}

@media (max-width: 992px) {
  .navbar-content {
    padding: 0 32px;
  }
}

@media (max-width: 768px) {
  .navbar-content {
    padding: 0 24px;
  }
  .navbar-links {
    display: none;
  }
  .navbar-actions {
    display: none;
  }
  .menu-toggle-btn {
    display: flex;
  }
}
</style>
