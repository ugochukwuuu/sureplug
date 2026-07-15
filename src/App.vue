<script setup>
import { ref, computed, onMounted, onErrorCaptured } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Navbar from './components/Navbar.vue';
import Footer from './components/Footer.vue';
import { brandConfig as brand, loadBrandConfig } from '@/services/brandService.js';

const route = useRoute();
const router = useRouter();
const isCheckout = computed(() => route.path === '/checkout');
const isAdmin = computed(() => route.path.startsWith('/admin'));
const isRecommender = computed(() => route.path === '/ai-recommender');
const showAdminNav = computed(() => route.path.startsWith('/admin') && route.path !== '/admin/login');

const handleLogout = () => {
  localStorage.removeItem('sureplug_admin_token');
  localStorage.removeItem('sureplug_admin_authenticated');
  router.push('/admin/login');
};

// Theme loader
onMounted(async () => {
  await loadBrandConfig();
});

// General Error Boundary
const hasError = ref(false);
const errorDetails = ref(null);

onErrorCaptured((err, instance, info) => {
  console.error('[Root Error Boundary Captured]:', err, info);
  hasError.value = true;
  errorDetails.value = err;
  return false; // Stop propagation
});

const handleRefresh = () => {
  window.location.reload();
};
</script>

<template>
  <!-- Runtime Fallback UI (Error Boundary) -->
  <div v-if="hasError" class="error-boundary-wrapper page-wrapper">
    <div class="error-boundary-card animate-fade-in">
      <h1 class="error-headline">Something went wrong.</h1>
      <p class="error-subtext">We've noted the issue and are working on it.</p>
      <button @click="handleRefresh" class="btn btn-yellow error-refresh-btn">
        Refresh Page
      </button>
    </div>
  </div>

  <div v-else class="app-container">
    <!-- Standard Header -->
    <Navbar v-if="!isCheckout && !isAdmin" />

    <!-- Checkout Header -->
    <header v-else-if="isCheckout" class="checkout-header">
      <div class="checkout-header-content">
        <router-link to="/" class="checkout-logo">
          <img :src="brand.logo" :alt="`${brand.brand_name} Logo`" class="logo-image" />
          <span class="logo-text">{{ brand.brand_name }}</span>
        </router-link>
        <div class="checkout-secure-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Secure Checkout
        </div>
      </div>
    </header>

    <!-- Admin Header -->
    <header v-else class="admin-header">
      <div class="admin-header-content">
        <router-link to="/" class="admin-logo">
          <img :src="brand.logo" :alt="`${brand.brand_name} Logo`" class="logo-image" />
          <span class="logo-text">{{ brand.brand_name }}</span>
          <span class="admin-logo-tag">Admin</span>
        </router-link>
        <nav v-if="showAdminNav" class="admin-nav-links">
          <router-link to="/admin" class="admin-nav-link" exact-active-class="active">Dashboard</router-link>
          <router-link to="/admin/orders" class="admin-nav-link" exact-active-class="active">Orders</router-link>
          <router-link to="/admin/product/new" class="admin-nav-link" exact-active-class="active">Add Product</router-link>
          <router-link to="/" class="admin-nav-link storefront-link">Storefront</router-link>
          <button @click="handleLogout" class="admin-logout-btn">Logout</button>
        </nav>
      </div>
    </header>

    <main class="main-content">
      <router-view />
    </main>

    <!-- Footer Rendering -->
    <Footer v-if="!isCheckout && !isAdmin && !isRecommender" />
    
    <footer v-else-if="isCheckout" class="checkout-footer">
      <div class="checkout-footer-content">
        <router-link to="/" class="checkout-footer-logo">{{ brand.brand_name }}</router-link>
        <div class="checkout-footer-links">
          <a href="#">Privacy Policy</a>
          <span>·</span>
          <a href="#">Terms</a>
          <span>·</span>
          <a href="#">Help Center</a>
        </div>
        <p class="checkout-footer-copy">© 2025 {{ brand.brand_name }}. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1 0 auto;
}

/* Checkout Header */
.checkout-header {
  background-color: var(--color-navy);
  color: var(--color-white);
  padding: 16px 48px;
}
.checkout-header-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.checkout-logo {
  display: flex;
  align-items: center;
  gap: 5px;
}
.checkout-logo .logo-image {
  height: 34px;
  width: auto;
  object-fit: contain;
  display: block;
}
.checkout-logo .logo-text {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  color: var(--color-white);
  letter-spacing: 0.02em;
}
.checkout-secure-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-muted-grey);
}
.lock-icon {
  stroke: var(--color-yellow);
}

.checkout-footer {
  background-color: #05081E;
  color: var(--color-muted-grey);
  padding: 24px;
  font-size: 13px;
  text-align: center;
  border-top: 1px solid rgba(255,255,255,0.05);
  margin-top: 80px;
}
.checkout-footer-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.checkout-footer-logo {
  font-family: var(--font-headings);
  font-weight: 800;
  font-size: 16px;
  color: var(--color-white);
}
.checkout-footer-links {
  display: flex;
  gap: 12px;
}
.checkout-footer-links a:hover {
  color: var(--color-white);
}
.checkout-footer-copy {
  margin-top: 4px;
}

/* Admin Header */
.admin-header {
  background-color: var(--color-navy);
  color: var(--color-white);
  padding: 16px 48px;
  border-bottom: 2px solid var(--color-yellow);
}
.admin-header-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.admin-logo {
  display: flex;
  align-items: center;
  gap: 4px;
}
.admin-logo .logo-image {
  height: 30px;
  width: auto;
  object-fit: contain;
  display: block;
}
.admin-logo .logo-text {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 400;
  color: var(--color-white);
  letter-spacing: 0.02em;
}
.admin-logo-tag {
  background-color: var(--color-yellow);
  color: var(--color-navy);
  font-family: var(--font-headings);
  font-size: 9px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.admin-nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
}
.admin-nav-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-muted-grey);
  transition: color 0.2s ease;
}
.admin-nav-link:hover, 
.admin-nav-link.active,
.admin-nav-link.router-link-active,
.admin-nav-link.router-link-exact-active {
  color: var(--color-yellow);
}
.storefront-link {
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-white);
}
.storefront-link:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: var(--color-white);
}

.admin-logout-btn {
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-muted-grey);
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}
.admin-logout-btn:hover {
  color: var(--color-yellow);
}

@media (max-width: 992px) {
  .checkout-header, .admin-header {
    padding: 16px 32px;
  }
}
@media (max-width: 768px) {
  .checkout-header, .admin-header {
    padding: 16px 24px;
  }
  .admin-header-content {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .admin-nav-links {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
}
</style>
