import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import MarketplaceView from '../views/MarketplaceView.vue';
import AIRecommenderView from '../views/AIRecommenderView.vue';
import DetailView from '../views/DetailView.vue';
import CheckoutView from '../views/CheckoutView.vue';
import SellDeviceView from '../views/SellDeviceView.vue';
import AdminDashboardView from '../views/admin/AdminDashboardView.vue';
import AdminProductCreateView from '../views/admin/AdminProductCreateView.vue';
import AdminProductEditView from '../views/admin/AdminProductEditView.vue';
import AdminLoginView from '../views/admin/AdminLoginView.vue';
import AdminRegisterView from '../views/admin/AdminRegisterView.vue';
import FavoritesView from '../views/FavoritesView.vue';
import TrackOrderView from '../views/TrackOrderView.vue';
import AdminOrdersView from '../views/admin/AdminOrdersView.vue';
import ReviewView from '../views/ReviewView.vue';

const routes = [
  {
    path: '/review',
    name: 'Review',
    component: ReviewView
  },
  {
    path: '/track/:reference',
    name: 'TrackOrder',
    component: TrackOrderView
  },
  {
    path: '/favorites',
    name: 'Favorites',
    component: FavoritesView
  },
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/marketplace',
    name: 'Marketplace',
    component: MarketplaceView
  },
  {
    path: '/ai-recommender',
    name: 'AIRecommender',
    component: AIRecommenderView
  },
  {
    path: '/product/:id',
    name: 'ProductDetail',
    component: DetailView
  },
  {
    path: '/checkout',
    name: 'Checkout',
    component: CheckoutView
  },
  {
    path: '/sell-your-device',
    name: 'SellDevice',
    component: SellDeviceView
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: AdminLoginView
  },
  {
    path: '/admin/register',
    name: 'AdminRegister',
    component: AdminRegisterView
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboardView
  },
  {
    path: '/admin/product/new',
    name: 'AdminProductCreate',
    component: AdminProductCreateView
  },
  {
    path: '/admin/product/edit/:id',
    name: 'AdminProductEdit',
    component: AdminProductEditView
  },
  {
    path: '/admin/orders',
    name: 'AdminOrders',
    component: AdminOrdersView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// Admin Authentication Route Guard
router.beforeEach((to, from, next) => {
  if (to.path.startsWith('/admin') && to.path !== '/admin/login' && to.path !== '/admin/register') {
    const token = localStorage.getItem('sureplug_admin_token');
    let isValid = false;
    if (token) {
      try {
        const payloadStr = token.split('.')[1];
        if (payloadStr) {
          const payload = JSON.parse(atob(payloadStr));
          const isExpired = payload.exp * 1000 < Date.now();
          if (!isExpired) {
            isValid = true;
          }
        }
      } catch (e) {
        console.error('Error decoding token payload:', e);
      }
    }

    if (!isValid) {
      localStorage.removeItem('sureplug_admin_token');
      localStorage.removeItem('sureplug_admin_authenticated');
      next('/admin/login');
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
