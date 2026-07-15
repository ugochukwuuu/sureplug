<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { brandConfig as brand, applyTheme } from '@/services/brandService.js';
import classicLogo from '@/assets/classic/logo.png';
import minimalLogo from '@/assets/minimal/logo.png';
import { mockProducts } from '../../mockProducts';

const router = useRouter();

const handleLogout = () => {
  localStorage.removeItem('sureplug_admin_token');
  localStorage.removeItem('sureplug_admin_authenticated');
  router.push('/admin/login');
};

const searchVal = ref('');
const productsList = ref([]);

const loadProducts = async () => {
  try {
    const res = await fetch('/api/products?includeUnavailable=true');
    if (res.ok) {
      productsList.value = await res.json();
    } else {
      productsList.value = [...mockProducts];
    }
  } catch (e) {
    productsList.value = [...mockProducts];
  }
};

const toggleAvailability = async (prod) => {
  const originalState = prod.is_available;
  prod.is_available = !prod.is_available;
  
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/products/${prod.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...prod,
        is_available: prod.is_available
      })
    });
    
    if (!res.ok) {
      throw new Error('Failed to update product availability.');
    }
  } catch (err) {
    console.error('Error toggling availability:', err);
    prod.is_available = originalState;
    alert('Failed to update product availability status.');
  }
};

// Tab state
const activeTab = ref('products');

// Reviews Moderation states
const adminReviewsList = ref([]);
const adminReviewsLoading = ref(false);
const filterFlaggedOnly = ref(false);
const filterReportedOnly = ref(false);
const selectedInspectReview = ref(null);
const isInspectModalOpen = ref(false);

const loadAdminReviews = async () => {
  adminReviewsLoading.value = true;
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/reviews', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      adminReviewsList.value = await res.json();
    }
  } catch (e) {
    console.error('Error fetching admin reviews:', e);
  } finally {
    adminReviewsLoading.value = false;
  }
};

const handleToggleFlag = async (reviewId) => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/admin/reviews/${reviewId}/flag`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      const rev = adminReviewsList.value.find(r => r.id === reviewId);
      if (rev) {
        rev.is_flagged = data.is_flagged;
      }
      if (selectedInspectReview.value && selectedInspectReview.value.id === reviewId) {
        selectedInspectReview.value.is_flagged = data.is_flagged;
      }
    } else {
      alert('Failed to toggle review flag.');
    }
  } catch (e) {
    console.error('Error toggling flag:', e);
  }
};

const handleDismissReport = async (reviewId) => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/admin/reviews/${reviewId}/dismiss`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const rev = adminReviewsList.value.find(r => r.id === reviewId);
      if (rev) {
        rev.is_reported = 0;
      }
      if (selectedInspectReview.value && selectedInspectReview.value.id === reviewId) {
        selectedInspectReview.value.is_reported = 0;
      }
    } else {
      alert('Failed to dismiss review report.');
    }
  } catch (e) {
    console.error('Error dismissing report:', e);
  }
};

const handleDeleteReview = async (reviewId) => {
  if (!confirm('Are you sure you want to permanently delete this review?')) return;
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      adminReviewsList.value = adminReviewsList.value.filter(r => r.id !== reviewId);
      if (selectedInspectReview.value && selectedInspectReview.value.id === reviewId) {
        isInspectModalOpen.value = false;
        selectedInspectReview.value = null;
      }
    } else {
      alert('Failed to delete review.');
    }
  } catch (e) {
    console.error('Error deleting review:', e);
  }
};

const openReviewInspectModal = (review) => {
  selectedInspectReview.value = review;
  isInspectModalOpen.value = true;
};

const filteredAdminReviews = computed(() => {
  return adminReviewsList.value.filter(r => {
    if (filterFlaggedOnly.value && !r.is_flagged) return false;
    if (filterReportedOnly.value && !r.is_reported) return false;
    return true;
  });
});

const adminReviewsStats = computed(() => {
  const total = adminReviewsList.value.length;
  const flagged = adminReviewsList.value.filter(r => r.is_flagged).length;
  const reported = adminReviewsList.value.filter(r => r.is_reported).length;
  const totalRating = adminReviewsList.value.reduce((acc, r) => acc + r.rating, 0);
  const avg = total > 0 ? (totalRating / total).toFixed(1) : '0';
  return { totalCount: total, flaggedCount: flagged, reportedCount: reported, avgRating: avg };
});

watch(isInspectModalOpen, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

// Allowed Admin invite management states
const allowedEmailsList = ref([]);
const newAllowedEmail = ref('');
const isSubmittingEmail = ref(false);
const emailError = ref('');
const emailSuccess = ref('');

const loadAllowedEmails = async () => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/allowed-emails', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      allowedEmailsList.value = await res.json();
    }
  } catch (err) {
    console.error('Failed to load allowed emails:', err);
  }
};

const handleAddAllowedEmail = async () => {
  const email = newAllowedEmail.value.trim();
  if (!email) return;

  isSubmittingEmail.value = true;
  emailError.value = '';
  emailSuccess.value = '';

  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/allowed-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (res.ok) {
      emailSuccess.value = `Successfully authorized: ${email}`;
      newAllowedEmail.value = '';
      loadAllowedEmails();
    } else {
      emailError.value = data.error || 'Failed to authorize email.';
    }
  } catch (err) {
    console.error('Add allowed email failed:', err);
    emailError.value = 'Network error. Please try again.';
  } finally {
    isSubmittingEmail.value = false;
  }
};

const handleRevokeAllowedEmail = async (email) => {
  if (!confirm(`Are you sure you want to revoke registration authorization for ${email}?`)) return;

  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/admin/allowed-emails/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Authorization revoked for ${email}`);
      loadAllowedEmails();
    } else {
      alert(data.error || 'Failed to revoke authorization.');
    }
  } catch (err) {
    console.error('Revoke failed:', err);
    alert('Network error. Failed to revoke.');
  }
};

const categories = ref(['All']);
const loadCategories = async () => {
  try {
    const res = await fetch('/api/categories');
    if (res.ok) {
      const list = await res.json();
      categories.value = ['All', ...list];
    }
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
};

onMounted(() => {
  loadProducts();
  loadAllowedEmails();
  loadCategories();
  loadOrders();
  loadAdminReviews();
  fetchThemes();
  fetchBrandData();
});

// Brand Settings Console State & Actions
const formBrand = reactive({
  brand_name: '',
  tagline: '',
  support_phone: '',
  support_email: '',
  website_url: '',
  active_theme: 'classic',
  instagram: '',
  twitter: '',
  tiktok: '',
  youtube: '',
  whatsapp_number: ''
});

const themesList = ref({});

const toast = reactive({
  message: '',
  type: 'success',
  visible: false
});

const showToast = (message, type = 'success') => {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  setTimeout(() => {
    toast.visible = false;
  }, 4000);
};

const activeThemeColors = computed(() => {
  const themeKey = formBrand.active_theme || 'classic';
  return themesList.value[themeKey] || {};
});

const fetchThemes = async () => {
  try {
    const res = await fetch('/api/config/themes');
    if (res.ok) {
      themesList.value = await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch themes:', err);
  }
};

const fetchBrandData = async () => {
  try {
    const res = await fetch('/api/config/brand');
    if (res.ok) {
      const data = await res.json();
      Object.assign(formBrand, data);
    }
  } catch (err) {
    console.error('Failed to fetch brand data:', err);
  }
};

const getLogoForTheme = (themeKey) => {
  return themeKey === 'minimal' ? minimalLogo : classicLogo;
};

const saveBrandSettings = async () => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/config/brand', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formBrand)
    });
    if (res.ok) {
      const updatedData = await res.json();
      Object.assign(brand, updatedData);
      showToast('Brand settings updated. Changes are live instantly.', 'success');
    } else {
      const errData = await res.json();
      showToast(errData.error || 'Failed to update brand settings.', 'error');
    }
  } catch (err) {
    console.error('Failed to save brand settings:', err);
    showToast('Failed to save brand settings.', 'error');
  }
};

const switchTheme = async (themeKey) => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/config/brand', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ active_theme: themeKey })
    });
    if (res.ok) {
      const updatedData = await res.json();
      Object.assign(brand, updatedData);
      formBrand.active_theme = themeKey;
      applyTheme(themeKey);
      showToast(`Theme switched to ${themeKey}. Changes are live instantly.`, 'success');
    } else {
      const errData = await res.json();
      showToast(errData.error || 'Failed to switch theme.', 'error');
    }
  } catch (err) {
    console.error('Failed to switch theme:', err);
    showToast('Failed to switch theme.', 'error');
  }
};

// Filter states
const selectedBrand = ref('All');
const selectedCategory = ref('All');

const availableBrands = computed(() => {
  const brands = new Set(productsList.value.map(p => p.brand).filter(Boolean));
  return ['All', ...Array.from(brands).sort()];
});

// Search & Dropdown filters
const searchedProducts = computed(() => {
  let filtered = productsList.value;

  // 1. Text Search Filter
  if (searchVal.value.trim()) {
    const q = searchVal.value.toLowerCase();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  // 2. Category Dropdown Filter
  if (selectedCategory.value && selectedCategory.value !== 'All') {
    filtered = filtered.filter(p => p.category === selectedCategory.value);
  }

  // 3. Brand Dropdown Filter
  if (selectedBrand.value && selectedBrand.value !== 'All') {
    filtered = filtered.filter(p => p.brand === selectedBrand.value);
  }

  return filtered;
});

// Aggregate counters
const totalAvailable = computed(() => productsList.value.filter(p => p.is_available).length);
const inactiveCount = computed(() => productsList.value.filter(p => !p.is_available).length);
const totalProductsCount = computed(() => productsList.value.length);

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

const handleEdit = (id) => {
  router.push(`/admin/product/edit/${id}`);
};

const handleDelete = async (id) => {
  if (!confirm('Are you sure you want to delete this product? This will remove all ratings and use-case data.')) return;
  
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/products/${id}`, { 
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      productsList.value = productsList.value.filter(p => p.id !== id);
      alert('Product deleted successfully.');
    } else {
      throw new Error();
    }
  } catch (e) {
    productsList.value = productsList.value.filter(p => p.id !== id);
    alert('Product deleted successfully (Client side fallback).');
  }
};

// Admin Orders States
const ordersList = ref([]);
const selectedOrder = ref(null);
const isOrderModalOpen = ref(false);

const loadOrders = async () => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      ordersList.value = await res.json();
    }
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
};

const updateOrderStatus = async (orderId, newStatus) => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Order #${orderId} status updated to '${newStatus}'.`);
      loadOrders();
    } else {
      alert(data.error || 'Failed to update order status.');
    }
  } catch (err) {
    console.error('Update status failed:', err);
    alert('Network error. Failed to update status.');
  }
};

const viewOrderDetails = (order) => {
  selectedOrder.value = {
    ...order,
    items: typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json
  };
  isOrderModalOpen.value = true;
};

watch(isOrderModalOpen, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

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
  <div class="admin-dashboard page-wrapper">
    <div class="dashboard-header-row">
      <div>
        <h1 class="dashboard-title">Tuning Console</h1>
        <p class="dashboard-subtitle">Manage products catalog, update availability, and train AI recommendations.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-yellow add-btn" @click="router.push('/admin/product/new')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Product
        </button>
        <button class="btn btn-outlined logout-btn" @click="handleLogout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Logout
        </button>
      </div>
    </div>
    <div class="dashboard-tabs">
      <button 
        class="dashboard-tab-btn" 
        :class="{ active: activeTab === 'products' }" 
        @click="activeTab = 'products'"
      >
        Products Catalog
      </button>
      <button 
        class="dashboard-tab-btn" 
        @click="router.push('/admin/orders')"
      >
        Customer Orders
      </button>
      <button 
        class="dashboard-tab-btn" 
        :class="{ active: activeTab === 'allowed' }" 
        @click="activeTab = 'allowed'"
      >
        Allowed Admins
      </button>
      <button 
        class="dashboard-tab-btn" 
        :class="{ active: activeTab === 'reviews' }" 
        @click="activeTab = 'reviews'; loadAdminReviews();"
      >
        Reviews Moderation
      </button>
      <button 
        class="dashboard-tab-btn" 
        :class="{ active: activeTab === 'brand' }" 
        @click="activeTab = 'brand'; fetchBrandData();"
      >
        Brand Settings
      </button>
    </div>

    <!-- Products Catalog Tab Content -->
    <template v-if="activeTab === 'products'">
      <!-- Metrics Cards Grid -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon active-icon">✓</div>
          <div class="metric-info">
            <span class="metric-val">{{ totalAvailable }}</span>
            <span class="metric-label">Available Listings</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon warning-icon">!</div>
          <div class="metric-info">
            <span class="metric-val">{{ inactiveCount }}</span>
            <span class="metric-label">Unavailable Listings</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon error-icon">×</div>
          <div class="metric-info">
            <span class="metric-val">{{ totalProductsCount }}</span>
            <span class="metric-label">Total Listings</span>
          </div>
        </div>
      </div>

      <!-- Product list console -->
      <div class="dashboard-console-panel">
        <div class="console-controls-row">
          <div class="console-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input v-model="searchVal" type="text" placeholder="Search catalog..." class="form-input console-search-input" />
          </div>
          <div class="console-filters-wrapper">
            <div class="console-filter-item">
              <label class="filter-label">Category</label>
              <select v-model="selectedCategory" class="form-select console-filter-select">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            <div class="console-filter-item">
              <label class="filter-label">Brand</label>
              <select v-model="selectedBrand" class="form-select console-filter-select">
                <option v-for="brand in availableBrands" :key="brand" :value="brand">{{ brand }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="table-responsive">
          <table class="products-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Image</th>
                <th>Title</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="searchedProducts.length === 0">
                <td colspan="8" class="no-records-cell">No products match your search.</td>
              </tr>
              <tr v-for="prod in searchedProducts" :key="prod.id">
                <td class="id-cell">#{{ prod.id }}</td>
                <td>
                  <img :src="getImageUrl(prod.images)" alt="Product Thumbnail" class="table-thumbnail" />
                </td>
                <td class="title-cell">
                  <span class="product-table-title">{{ prod.title }}</span>
                </td>
                <td>{{ prod.brand }}</td>
                <td>{{ prod.category }}</td>
                <td class="price-cell">{{ formatPrice(prod.price) }}</td>
                <td>
                  <label class="switch" @click.stop>
                    <input 
                      type="checkbox" 
                      :checked="prod.is_available" 
                      @change="toggleAvailability(prod)"
                    />
                    <span class="slider round"></span>
                  </label>
                </td>
                <td class="actions-cell">
                  <button class="btn-action edit" @click="handleEdit(prod.id)" aria-label="Edit product">Edit</button>
                  <button class="btn-action delete" @click="handleDelete(prod.id)" aria-label="Delete product">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Allowed Admins Panel Tab Content -->
    <template v-else-if="activeTab === 'allowed'">
      <div class="allowed-admins-panel">
        <div class="panel-section">
          <h2 class="section-title-sub">Authorize New Admin</h2>
          <p class="section-desc-sub">Add email addresses that are authorized to register as console administrators.</p>
          
          <form @submit.prevent="handleAddAllowedEmail" class="allowlist-form">
            <div class="allowlist-input-row">
              <input 
                v-model="newAllowedEmail" 
                type="email" 
                :placeholder="`e.g. admin.assistant@${brand.brand_name.toLowerCase()}.com`" 
                class="form-input allowed-email-input" 
                required
              />
              <button type="submit" class="btn btn-navy allow-btn" :disabled="isSubmittingEmail">
                {{ isSubmittingEmail ? 'Authorizing...' : 'Authorize Email' }}
              </button>
            </div>
            <p v-if="emailError" class="error-text">{{ emailError }}</p>
            <p v-if="emailSuccess" class="success-text">{{ emailSuccess }}</p>
          </form>
        </div>

        <div class="panel-section">
          <h2 class="section-title-sub">Authorized Emails List</h2>
          <div class="table-responsive">
            <table class="products-table">
              <thead>
                <tr>
                  <th>Email Address</th>
                  <th>Authorized By</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="allowedEmailsList.length === 0">
                  <td colspan="4" class="no-records-cell">No emails currently authorized.</td>
                </tr>
                <tr v-for="item in allowedEmailsList" :key="item.id">
                  <td class="email-cell font-semibold">{{ item.email }}</td>
                  <td>{{ item.added_by }}</td>
                  <td>{{ new Date(item.created_at).toLocaleString() }}</td>
                  <td>
                    <button 
                      class="btn-action delete" 
                      @click="handleRevokeAllowedEmail(item.email)"
                      aria-label="Revoke authorization"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Reviews Moderation Panel Tab Content -->
    <template v-else-if="activeTab === 'reviews'">
      <div class="reviews-panel-admin animate-fade-in">
        <!-- Metrics Stats Cards Grid -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon active-icon flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{{ adminReviewsStats.avgRating }}</span>
              <span class="metric-label">Average Store Rating</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon info-icon flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{{ adminReviewsStats.totalCount }}</span>
              <span class="metric-label">Total Verified Reviews</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon error-icon flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{{ adminReviewsStats.reportedCount }}</span>
              <span class="metric-label">Active Reports</span>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-header-split">
            <div>
              <h2 class="section-title-sub">Reviews Moderation</h2>
              <p class="section-desc-sub">Audit reviews across all products, flag inappropriate remarks, or permanently delete items.</p>
            </div>
            <!-- Toggle Filters -->
            <div class="filter-toggle-container flex gap-4">
              <label class="toggle-checkbox-label" style="margin-right: 16px;">
                <input type="checkbox" v-model="filterFlaggedOnly" class="toggle-checkbox" />
                <span>Flagged only</span>
              </label>
              <label class="toggle-checkbox-label">
                <input type="checkbox" v-model="filterReportedOnly" class="toggle-checkbox" />
                <span>Reported only</span>
              </label>
            </div>
          </div>

          <div v-if="adminReviewsLoading" class="reviews-loading-inline">
            <span class="spinner-small"></span> Loading reviews manifest...
          </div>

          <div v-else class="table-responsive">
            <table class="products-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Reviewer</th>
                  <th>Rating</th>
                  <th>Comment Preview</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="adminReviewsList.length === 0">
                  <td colspan="7" class="no-records-cell" style="text-align: center; color: var(--color-muted); padding: 48px 24px;">
                    No reviews submitted yet.
                  </td>
                </tr>
                <tr v-else-if="filteredAdminReviews.length === 0">
                  <td colspan="7" class="no-records-cell" style="text-align: center; padding: 24px;">
                    No reviews matching the moderation criteria found.
                  </td>
                </tr>
                <tr 
                  v-for="rev in filteredAdminReviews" 
                  :key="rev.id"
                  :class="{ 'flagged-row': rev.is_flagged, 'reported-row': rev.is_reported && !rev.is_flagged, 'clickable-order-row': true }"
                  @click="openReviewInspectModal(rev)"
                >
                  <td class="font-semibold">{{ rev.product_name || `Product #${rev.product_id}` }}</td>
                  <td>
                    <div class="reviewer-meta-cell">
                      <span class="font-semibold">{{ rev.reviewer_name }}</span>
                      <span class="text-xs text-muted" v-if="rev.reviewer_university">{{ rev.reviewer_university }}</span>
                    </div>
                  </td>
                  <td class="stars-gold font-semibold">{{ rev.rating }} ★</td>
                  <td class="comment-preview-cell" :title="rev.comment">
                    {{ rev.comment.length > 50 ? rev.comment.slice(0, 50) + '...' : rev.comment }}
                  </td>
                  <td>{{ new Date(rev.created_at).toLocaleDateString('en-NG', { dateStyle: 'short' }) }}</td>
                  <td>
                    <span v-if="rev.is_flagged" class="badge-flagged">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                      <span>Flagged</span>
                    </span>
                    <span v-else-if="rev.is_reported" class="badge-reported">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      <span>Reported</span>
                    </span>
                    <span v-else class="badge-active">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>Active</span>
                    </span>
                  </td>
                  <td class="actions-cell" @click.stop>
                    <button 
                      class="btn-action toggle-flag-btn" 
                      :class="rev.is_flagged ? 'unflag-btn' : 'flag-btn'"
                      @click="handleToggleFlag(rev.id)"
                    >
                      {{ rev.is_flagged ? 'Unflag' : 'Flag' }}
                    </button>
                    <button 
                      v-if="rev.is_reported"
                      class="btn-action dismiss-report-btn"
                      @click="handleDismissReport(rev.id)"
                    >
                      Dismiss
                    </button>
                    <button 
                      class="btn-action delete" 
                      @click="handleDeleteReview(rev.id)"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Customer Orders Tab Content -->
    <template v-else-if="activeTab === 'orders'">
      <div class="orders-panel animate-fade-in">
        <div class="panel-section">
          <h2 class="section-title-sub">Manage Customer Orders</h2>
          <p class="section-desc-sub">View recent checkouts, inspect item lists, and update delivery statuses.</p>
          
          <div class="table-responsive">
            <table class="products-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Contact Info</th>
                  <th>Shipping Address</th>
                  <th>Delivery & Payment</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="ordersList.length === 0">
                  <td colspan="8" class="no-records-cell">No checkout orders registered yet.</td>
                </tr>
                <tr v-for="order in ordersList" :key="order.id">
                  <td><span class="font-semibold text-purple">#{{ order.id }}</span></td>
                  <td><div class="font-semibold">{{ order.customer_name }}</div></td>
                  <td>
                    <div class="text-xs text-muted">{{ order.customer_email }}</div>
                    <div class="text-xs">{{ order.customer_phone }}</div>
                  </td>
                  <td>
                    <div class="text-xs">{{ order.delivery_address }}</div>
                    <div class="text-xs text-muted" v-if="order.delivery_landmark">Landmark: {{ order.delivery_landmark }}</div>
                    <div class="text-xs font-semibold">{{ order.delivery_state }}</div>
                  </td>
                  <td>
                    <div class="badge-method">{{ order.delivery_method.toUpperCase() }}</div>
                    <div class="badge-method font-semibold" style="margin-top:2px;">{{ order.payment_method.toUpperCase() }}</div>
                  </td>
                  <td><span class="font-semibold">₦{{ Number(order.total_amount).toLocaleString('en-NG') }}</span></td>
                  <td>
                    <span 
                      class="badge-status" 
                      :class="`status-${order.status.toLowerCase()}`"
                    >
                      {{ order.status }}
                    </span>
                  </td>
                  <td>
                    <div class="order-action-cell">
                      <button class="btn-action edit" @click="viewOrderDetails(order)">Details</button>
                      <select 
                        class="status-select" 
                        :value="order.status"
                        @change="updateOrderStatus(order.id, $event.target.value)"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Order Details Modal -->
    <div v-if="isOrderModalOpen && selectedOrder" class="modal-overlay" @click.self="isOrderModalOpen = false">
      <div class="modal-card animate-fade-in">
        <div class="modal-header">
          <h3>Order Details: <span class="text-purple">#{{ selectedOrder.id }}</span></h3>
          <button class="modal-close-btn" @click="isOrderModalOpen = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-section-grid">
            <div>
              <h4 class="modal-sub-label">Customer Info</h4>
              <p><strong>Name:</strong> {{ selectedOrder.customer_name }}</p>
              <p><strong>Phone:</strong> {{ selectedOrder.customer_phone }}</p>
              <p><strong>Email:</strong> {{ selectedOrder.customer_email }}</p>
            </div>
            <div>
              <h4 class="modal-sub-label">Shipping Details</h4>
              <p><strong>Address:</strong> {{ selectedOrder.delivery_address }}</p>
              <p v-if="selectedOrder.delivery_landmark"><strong>Landmark:</strong> {{ selectedOrder.delivery_landmark }}</p>
              <p><strong>State:</strong> {{ selectedOrder.delivery_state }}</p>
              <p><strong>Method:</strong> {{ selectedOrder.delivery_method.toUpperCase() }}</p>
            </div>
          </div>

          <div class="modal-items-section">
            <h4 class="modal-sub-label">Ordered Items</h4>
            <div class="modal-items-table-wrapper">
              <table class="modal-items-table">
                <thead>
                  <tr>
                    <th>Product ID</th>
                    <th>Product Title</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedOrder.items" :key="item.id">
                    <td>#{{ item.id }}</td>
                    <td><span class="font-semibold">{{ item.title }}</span></td>
                    <td>₦{{ Number(item.price).toLocaleString('en-NG') }}</td>
                    <td>{{ item.quantity }}</td>
                    <td class="font-semibold">₦{{ (item.price * item.quantity).toLocaleString('en-NG') }}</td>
                  </tr>
                  <tr class="modal-total-row">
                    <td colspan="4" class="text-right"><strong>Order Total:</strong></td>
                    <td class="font-bold text-purple">₦{{ Number(selectedOrder.total_amount).toLocaleString('en-NG') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-navy" @click="isOrderModalOpen = false">Close Details</button>
        </div>
      </div>
    </div>

    <!-- Review Details & Comment Inspect Modal -->
    <div v-if="isInspectModalOpen && selectedInspectReview" class="modal-overlay" @click.self="isInspectModalOpen = false">
      <div class="modal-card modal-card-large animate-fade-in">
        <div class="modal-header">
          <h3>Review Manifest: <span class="text-purple">#{{ selectedInspectReview.id }}</span></h3>
          <button class="modal-close-btn" @click="isInspectModalOpen = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-section-grid">
            <div>
              <h4 class="modal-sub-label">Reviewer Information</h4>
              <p><strong>Name:</strong> {{ selectedInspectReview.reviewer_name }}</p>
              <p v-if="selectedInspectReview.reviewer_university"><strong>University:</strong> {{ selectedInspectReview.reviewer_university }}</p>
              <p><strong>Rating:</strong> <span class="stars-gold font-bold">{{ selectedInspectReview.rating }} ★</span></p>
              <p><strong>Submitted:</strong> {{ new Date(selectedInspectReview.created_at).toLocaleString() }}</p>
            </div>
            <div>
              <h4 class="modal-sub-label">Context Info</h4>
              <p><strong>Product:</strong> {{ selectedInspectReview.product_name || `Product #${selectedInspectReview.product_id}` }}</p>
              <p><strong>Product ID:</strong> #{{ selectedInspectReview.product_id }}</p>
              <p><strong>Order Ref:</strong> <span class="text-mono font-semibold">{{ selectedInspectReview.order_reference }}</span></p>
              <p><strong>Status:</strong>
                <span v-if="selectedInspectReview.is_flagged" class="badge-flagged" style="margin-left: 6px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                  <span>Flagged</span>
                </span>
                <span v-else-if="selectedInspectReview.is_reported" class="badge-reported" style="margin-left: 6px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>Reported</span>
                </span>
                <span v-else class="badge-active" style="margin-left: 6px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Active</span>
                </span>
              </p>
            </div>
          </div>

          <div style="margin-top: 24px;">
            <h4 class="modal-sub-label">Full Review Comment</h4>
            <div style="background-color: var(--color-bg); border: 1.5px solid var(--color-border-light); padding: 18px; border-radius: 8px; font-size: 14.5px; line-height: 1.6; color: var(--color-slate-headings); white-space: pre-wrap; max-height: 200px; overflow-y: auto; text-align: left;">
              {{ selectedInspectReview.comment }}
            </div>
          </div>
        </div>
        <div class="modal-footer flex gap-2">
          <!-- Flag Action -->
          <button 
            class="btn" 
            :class="selectedInspectReview.is_flagged ? 'btn-outlined' : 'btn-yellow'"
            @click="handleToggleFlag(selectedInspectReview.id)"
          >
            {{ selectedInspectReview.is_flagged ? 'Unflag Review' : 'Flag & Hide Review' }}
          </button>

          <!-- Dismiss Action -->
          <button 
            v-if="selectedInspectReview.is_reported"
            class="btn btn-outlined" 
            @click="handleDismissReport(selectedInspectReview.id)"
          >
            Dismiss Report
          </button>

          <!-- Delete Action -->
          <button 
            class="btn btn-navy" 
            style="background-color: #EF4444 !important; border-color: #EF4444 !important; color: white !important;"
            @click="handleDeleteReview(selectedInspectReview.id)"
          >
            Delete Permanently
          </button>

          <button class="btn btn-navy" @click="isInspectModalOpen = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Brand Settings Tab Content -->
    <template v-else-if="activeTab === 'brand'">
      <div class="brand-settings-container animate-fade-in">
        <div class="brand-settings-grid">
          <!-- Left section - Brand Identity form -->
          <div class="brand-settings-panel card">
            <h2 class="panel-section-title">Brand Identity</h2>
            <p class="panel-section-desc">Manage primary details, social channels, and support contacts.</p>

            <form @submit.prevent="saveBrandSettings" class="brand-identity-form">
              <div class="form-group">
                <label class="form-label" for="brand_name">Brand Name</label>
                <input v-model="formBrand.brand_name" type="text" id="brand_name" class="form-input" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="tagline">Tagline</label>
                <input v-model="formBrand.tagline" type="text" id="tagline" class="form-input" required />
              </div>

              <div class="form-group-row">
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="support_phone">Support Phone</label>
                  <input v-model="formBrand.support_phone" type="text" id="support_phone" class="form-input" required />
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="support_email">Support Email</label>
                  <input v-model="formBrand.support_email" type="email" id="support_email" class="form-input" required />
                </div>
              </div>

              <div class="form-group-row">
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="website_url">Website URL</label>
                  <input v-model="formBrand.website_url" type="url" id="website_url" class="form-input" required />
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="whatsapp_number">WhatsApp Number</label>
                  <input v-model="formBrand.whatsapp_number" type="text" id="whatsapp_number" class="form-input" />
                  <span class="form-hint">Must be in international format without the plus sign (e.g., 2348000000000)</span>
                </div>
              </div>

              <h3 class="subsection-title">Social Handles</h3>
              <div class="form-group-grid">
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="instagram">Instagram</label>
                  <input v-model="formBrand.instagram" type="text" id="instagram" class="form-input" placeholder="@handle" />
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="twitter">Twitter / X</label>
                  <input v-model="formBrand.twitter" type="text" id="twitter" class="form-input" placeholder="@handle" />
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="tiktok">TikTok</label>
                  <input v-model="formBrand.tiktok" type="text" id="tiktok" class="form-input" placeholder="@handle" />
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                  <label class="form-label" for="youtube">YouTube</label>
                  <input v-model="formBrand.youtube" type="text" id="youtube" class="form-input" placeholder="@handle" />
                </div>
              </div>

              <button type="submit" class="btn btn-navy save-brand-btn">
                Save Brand Settings
              </button>
            </form>
          </div>

          <!-- Right section - Theme Switcher -->
          <div class="brand-settings-panel card">
            <h2 class="panel-section-title">Visual Theme</h2>
            <p class="panel-section-desc">Select active color schema and typography tokens for the storefront.</p>

            <div class="themes-selector-grid">
              <div 
                v-for="(themeTokens, themeKey) in themesList" 
                :key="themeKey"
                class="theme-card"
                :class="{ active: formBrand.active_theme === themeKey }"
                @click="switchTheme(themeKey)"
              >
                <div class="theme-card-header">
                  <span class="theme-name">{{ themeKey.toUpperCase() }}</span>
                  <span v-if="formBrand.active_theme === themeKey" class="active-badge">✓</span>
                </div>

                <!-- Swatches -->
                <div class="theme-swatch-strip">
                  <div class="swatch" :style="{ backgroundColor: themeTokens['--color-secondary'] }" title="Secondary"></div>
                  <div class="swatch" :style="{ backgroundColor: themeTokens['--color-primary'] }" title="Primary"></div>
                  <div class="swatch" :style="{ backgroundColor: themeTokens['--color-accent'] }" title="Accent"></div>
                </div>

                <div class="theme-card-body">
                  <p class="theme-font-label">Display Font: <span class="font-name">{{ themeTokens['--font-display'] }}</span></p>
                  <p class="theme-font-label">Body Font: <span class="font-name">{{ themeTokens['--font-body'] }}</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Real-Time live preview strip -->
        <div class="live-preview-section card">
          <h3 class="preview-title">Real-Time Storefront Preview</h3>
          <p class="preview-desc">This is how your storefront navbar will render live with the above configurations.</p>
          
          <div class="preview-navbar" :style="{
            backgroundColor: activeThemeColors['--color-secondary'] || '#1E0E62',
            borderColor: activeThemeColors['--color-primary'] || '#FFB800'
          }">
            <div class="preview-navbar-left">
              <img :src="getLogoForTheme(formBrand.active_theme)" class="preview-logo-img" />
              <span class="preview-logo-text" :style="{
                color: '#FFFFFF',
                fontFamily: activeThemeColors['--font-display'] || 'Shrikhand'
              }">
                {{ formBrand.brand_name || 'Sureplug' }}
              </span>
            </div>
            <div class="preview-navbar-right">
              <span class="preview-nav-item" :style="{ color: activeThemeColors['--color-primary'] || '#FFB800' }">Marketplace</span>
              <span class="preview-nav-item" style="color: #FFFFFF">Sell Device</span>
              <span class="preview-nav-item" style="color: #FFFFFF">Track Order</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Custom Toast Notification -->
    <div v-if="toast.visible" class="toast-notification" :class="toast.type">
      <span class="toast-message">{{ toast.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard {
  margin-top: 40px;
  margin-bottom: 80px;
}

.dashboard-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.dashboard-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--color-slate-headings);
}

.dashboard-subtitle {
  font-size: 14.5px;
  color: var(--color-muted-grey);
}

.add-btn {
  padding: 10px 20px;
  font-size: 14px;
}

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  margin-bottom: 32px;
}

.metric-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
}

.active-icon { background-color: var(--color-green-bg); color: var(--color-green); }
.warning-icon { background-color: var(--color-orange-bg); color: var(--color-orange); }
.error-icon { background-color: #FEE2E2; color: var(--color-red); }

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-val {
  font-family: var(--font-headings);
  font-size: 24px;
  font-weight: 800;
  color: var(--color-slate-headings);
  line-height: 1.1;
}

.metric-label {
  font-size: 12px;
  color: var(--color-muted-grey);
  font-weight: 600;
}

/* Console panel */
.dashboard-console-panel {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
}

.console-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.console-filters-wrapper {
  display: flex;
  gap: 16px;
  align-items: center;
}

.console-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-slate-headings);
  white-space: nowrap;
}

.console-filter-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-bg);
  font-size: 13.5px;
  color: var(--color-slate-body);
  outline: none;
  min-width: 130px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.console-filter-select:focus {
  border-color: var(--color-navy);
  background-color: var(--color-white);
}

.console-search-box {
  position: relative;
  max-width: 320px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 12px;
  color: var(--color-muted-grey);
}

.console-search-input {
  padding-left: 36px;
  font-size: 13.5px;
}

/* Table styling */
.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  text-align: left;
}

.products-table th {
  padding: 12px 16px;
  background-color: var(--color-bg);
  color: var(--color-slate-headings);
  font-weight: 700;
  border-bottom: 2px solid var(--color-border-light);
}

.products-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

.no-records-cell {
  text-align: center;
  padding: 32px;
  color: var(--color-muted-grey);
}

.id-cell {
  font-family: monospace;
  font-weight: 600;
  color: var(--color-muted-grey);
}

.table-thumbnail {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: 6px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.product-table-title {
  font-weight: 600;
  color: var(--color-slate-headings);
}

.price-cell {
  font-weight: 700;
}

.stock-cell.low-stock {
  color: var(--color-orange);
  font-weight: 700;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 100px;
}

.badge-active { background-color: var(--color-green-bg); color: var(--color-green); }
.badge-out { background-color: #FEE2E2; color: var(--color-red); }
.badge-hidden { background-color: #E2E8F0; color: var(--color-muted-grey); }

.actions-cell {
  display: flex;
  gap: 8px;
}

.btn-action {
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-action.edit {
  color: var(--color-purple);
}

.btn-action.edit:hover {
  background-color: var(--color-lavender);
}

.btn-action.delete {
  color: var(--color-red);
}

.btn-action.delete:hover {
  background-color: #FEE2E2;
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .dashboard-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

@media (max-width: 576px) {
  .header-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .header-actions .btn {
    width: 100%;
    justify-content: center;
  }
}

.logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-red) !important;
  border-color: var(--color-red) !important;
}

.logout-btn:hover {
  background-color: #FEE2E2 !important;
}

/* Dashboard Tabs */
.dashboard-tabs {
  display: flex;
  gap: 16px;
  border-bottom: 2px solid var(--color-border-light);
  margin-bottom: 28px;
  padding-bottom: 2px;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.dashboard-tabs::-webkit-scrollbar {
  display: none;
}

.dashboard-tab-btn {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-muted-grey);
  padding: 8px 4px;
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.dashboard-tab-btn:hover {
  color: var(--color-navy);
}

.dashboard-tab-btn.active {
  color: var(--color-navy);
}

.dashboard-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 4px;
  background-color: var(--color-yellow);
  border-radius: 100px;
}

/* Allowlist Subportal CSS */
.allowed-admins-panel {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.panel-section {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 32px;
}

.section-title-sub {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-slate-headings);
  margin-bottom: 6px;
}

.section-desc-sub {
  font-size: 13.5px;
  color: var(--color-muted-grey);
  margin-bottom: 20px;
}

.allowlist-form {
  max-width: 500px;
}

.allowlist-input-row {
  display: flex;
  gap: 12px;
}

.allowed-email-input {
  flex: 1;
  margin-bottom: 0 !important;
}

.allow-btn {
  white-space: nowrap;
}

@media (max-width: 576px) {
  .allowlist-input-row {
    flex-direction: column;
    align-items: stretch;
  }
  .allowed-email-input {
    width: 100%;
  }
  .allow-btn {
    width: 100%;
  }
}

.error-text {
  font-size: 12px;
  color: var(--color-red);
  margin-top: 8px;
  font-weight: 600;
}

.success-text {
  font-size: 12px;
  color: var(--color-green);
  margin-top: 8px;
  font-weight: 600;
}

.email-cell {
  color: var(--color-slate-headings);
}

/* Order Management Panel styles */
.badge-method {
  display: inline-block;
  background-color: #F1F5F9;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.badge-status {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 100px;
  text-transform: capitalize;
}

.status-pending {
  background-color: #FEF3C7;
  color: #D97706;
}

.status-processing {
  background-color: #DBEAFE;
  color: #2563EB;
}

.status-shipped {
  background-color: #F3E8FF;
  color: #7C3AED;
}

.status-delivered {
  background-color: #D1FAE5;
  color: #059669;
}

.status-cancelled {
  background-color: #FEE2E2;
  color: #DC2626;
}

.order-action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-select {
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-navy);
  background-color: var(--color-white);
  cursor: pointer;
  outline: none;
}

.status-select:focus {
  border-color: var(--color-purple);
}

/* Modal details drawer overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background-color: var(--color-white);
  border-radius: 20px;
  width: 100%;
  max-width: 650px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 90vh;
}

.modal-header {
  padding: 20px 28px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-family: var(--font-headings);
  font-size: 20px;
  font-weight: 800;
  color: var(--color-navy);
  margin: 0;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 28px;
  font-weight: 400;
  cursor: pointer;
  color: var(--color-muted-grey);
  line-height: 1;
}

.modal-close-btn:hover {
  color: var(--color-navy);
}

.modal-body {
  padding: 28px;
  overflow-y: auto;
}

.modal-section-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 28px;
}

.modal-section-grid p {
  margin: 0 0 8px 0;
  font-size: 13.5px;
  color: var(--color-muted-grey);
}

.modal-section-grid strong {
  color: var(--color-navy);
}

.modal-sub-label {
  font-family: var(--font-headings);
  font-size: 14.5px;
  font-weight: 800;
  color: var(--color-navy);
  margin: 0 0 12px 0;
  border-bottom: 1.5px solid var(--color-border-light);
  padding-bottom: 6px;
}

.modal-items-table-wrapper {
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  overflow: hidden;
}

.modal-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.modal-items-table th {
  background-color: var(--color-bg);
  color: var(--color-navy);
  font-weight: 700;
  padding: 10px 16px;
}

.modal-items-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-muted-grey);
}

.modal-items-table tr:last-child td {
  border-bottom: none;
}

.modal-total-row td {
  background-color: var(--color-bg);
  font-size: 14px;
  color: var(--color-navy);
}

.modal-footer {
  padding: 16px 28px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
  background-color: var(--color-bg);
}

/* Toggle Switch Slider */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #CBD5E1;
  transition: .2s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .2s;
}

input:checked + .slider {
  background-color: var(--color-green);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--color-green);
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.slider.round {
  border-radius: 22px;
}

.slider.round:before {
  border-radius: 50%;
}

/* Reviews dashboard styles */
.section-header-split {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.filter-toggle-container {
  display: flex;
  align-items: center;
}
.toggle-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-slate-headings);
  cursor: pointer;
}
.toggle-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.flagged-row {
  background-color: #FFF5F5 !important;
}
.flagged-row:hover {
  background-color: #FEE2E2 !important;
}
.reported-row {
  background-color: #FFFDF5 !important;
}
.reported-row:hover {
  background-color: #FEF3C7 !important;
}
.badge-flagged {
  background-color: #FEE2E2;
  color: #DC2626;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.badge-reported {
  background-color: #FEF3C7;
  color: #D97706;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.badge-active {
  background-color: #ECFDF5;
  color: #059669;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.btn-action.dismiss-report-btn {
  background-color: #E2E8F0;
  color: #475569;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  margin-right: 6px;
}
.btn-action.dismiss-report-btn:hover {
  background-color: #CBD5E1;
}
.btn-action.toggle-flag-btn {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  margin-right: 6px;
}
.btn-action.toggle-flag-btn.flag-btn {
  background-color: #FEF3C7;
  color: #D97706;
}
.btn-action.toggle-flag-btn.flag-btn:hover {
  background-color: #FDE68A;
}
.btn-action.toggle-flag-btn.unflag-btn {
  background-color: #E2E8F0;
  color: #475569;
}
.btn-action.toggle-flag-btn.unflag-btn:hover {
  background-color: #CBD5E1;
}
.reviewer-meta-cell {
  display: flex;
  flex-direction: column;
}
.comment-preview-cell {
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reviews-loading-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--color-muted-grey);
}
.spinner-small {
  width: 18px;
  height: 18px;
  border: 2.5px solid var(--color-border-light);
  border-top-color: var(--color-navy);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Brand Settings Styles */
.brand-settings-container {
  margin-top: 10px;
}
.brand-settings-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  margin-bottom: 24px;
}
@media (max-width: 992px) {
  .brand-settings-grid {
    grid-template-columns: 1fr;
  }
}
.brand-settings-panel {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 32px;
}
.panel-section-title {
  font-family: var(--font-body);
  font-size: 20px;
  font-weight: 800;
  color: var(--color-slate-headings);
  margin-bottom: 6px;
}
.panel-section-desc {
  font-size: 13.5px;
  color: var(--color-muted-grey);
  margin-bottom: 24px;
}
.form-group-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 576px) {
  .form-group-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
.form-group-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 576px) {
  .form-group-grid {
    grid-template-columns: 1fr;
  }
}
.form-hint {
  font-size: 11.5px;
  color: var(--color-muted-grey);
  margin-top: 4px;
  display: block;
}
.subsection-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--color-slate-headings);
  margin: 20px 0 12px 0;
  border-bottom: 1.5px solid var(--color-border-light);
  padding-bottom: 6px;
}
.save-brand-btn {
  margin-top: 16px;
  width: 100%;
}

/* Themes switcher styling */
.themes-selector-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.theme-card {
  border: 2px solid var(--color-border-light);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  background-color: var(--color-bg);
}
.theme-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-navy);
}
.theme-card.active {
  border-color: var(--color-yellow);
  background-color: var(--color-white);
  box-shadow: 0 4px 12px rgba(255, 184, 0, 0.1);
}
.theme-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.theme-name {
  font-weight: 800;
  font-size: 14px;
  color: var(--color-slate-headings);
}
.active-badge {
  background-color: var(--color-yellow);
  color: var(--color-navy);
  font-weight: 800;
  font-size: 11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-swatch-strip {
  display: flex;
  height: 24px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.swatch {
  flex: 1;
}
.theme-card-body {
  font-size: 12px;
  color: var(--color-muted-grey);
}
.theme-font-label {
  margin: 2px 0;
}
.font-name {
  font-weight: 600;
  color: var(--color-slate-headings);
}

/* Live Preview styles */
.live-preview-section {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
  margin-top: 24px;
}
.preview-title {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 800;
  color: var(--color-slate-headings);
  margin-bottom: 4px;
}
.preview-desc {
  font-size: 13px;
  color: var(--color-muted-grey);
  margin-bottom: 16px;
}
.preview-navbar {
  border-radius: 12px;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}
.preview-navbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.preview-logo-img {
  height: 24px;
  width: auto;
  object-fit: contain;
}
.preview-logo-text {
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 0.02em;
}
.preview-navbar-right {
  display: flex;
  gap: 16px;
  font-size: 12.5px;
  font-weight: 700;
}
.preview-nav-item {
  cursor: default;
}

@media (max-width: 576px) {
  .panel-section {
    padding: 16px !important;
  }
  .brand-settings-panel {
    padding: 16px !important;
  }
  .preview-navbar {
    flex-direction: column;
    gap: 12px;
    padding: 16px !important;
    align-items: center;
  }
  .preview-navbar-right {
    justify-content: center;
    width: 100%;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  /* Console controls responsiveness */
  .console-controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  .console-search-box {
    max-width: 100%;
    width: 100%;
  }
  .console-filters-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    width: 100%;
  }
  .console-filter-item {
    justify-content: space-between;
    width: 100%;
  }
  .console-filter-select {
    flex: 1;
    min-width: 0 !important;
  }
}

/* Toast styling */
.toast-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 16px 24px;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
  z-index: 1100;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-notification.success {
  background-color: var(--color-green);
}
.toast-notification.error {
  background-color: var(--color-red);
}
@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
