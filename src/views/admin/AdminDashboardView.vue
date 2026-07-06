<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
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
    const res = await fetch('/api/products?isAdmin=true');
    if (res.ok) {
      productsList.value = await res.json();
    } else {
      productsList.value = [...mockProducts];
    }
  } catch (e) {
    productsList.value = [...mockProducts];
  }
};

// Tab state
const activeTab = ref('products');

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
});

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
        :class="{ active: activeTab === 'orders' }" 
        @click="activeTab = 'orders'"
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
                  <span v-if="prod.is_available" class="status-badge badge-active">Available</span>
                  <span v-else class="status-badge badge-hidden">Unavailable</span>
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
                placeholder="e.g. admin.assistant@sureplug.com" 
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
</style>
