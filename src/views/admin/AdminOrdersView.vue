<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { brand } from '@/config/brand.js';

const router = useRouter();

// State management
const ordersList = ref([]);
const stats = ref({
  ordersToday: 0,
  revenueToday: 0,
  pendingFulfillments: 0,
  deliveredAllTime: 0
});
const productsList = ref([]);
const isLoading = ref(false);
const errorMsg = ref('');

// Filter states
const searchQuery = ref('');
const filterPaymentStatus = ref('all');
const filterFulfillmentStatus = ref('all');
const startDate = ref('');
const endDate = ref('');

// Modal details state
const selectedOrder = ref(null);
const isModalOpen = ref(false);
const isUpdatingFulfillment = ref(false);

// Fetch products for resolving images in details view
const loadProducts = async () => {
  try {
    const res = await fetch('/api/products?includeUnavailable=true');
    if (res.ok) {
      productsList.value = await res.json();
    }
  } catch (e) {
    console.error('Failed to load products for mapping:', e);
  }
};

const productsMap = computed(() => {
  const map = {};
  productsList.value.forEach(p => {
    map[p.id] = p;
  });
  return map;
});

const getProductImage = (itemId) => {
  const p = productsMap.value[itemId];
  if (!p) return brand.logo; // fallback placeholder
  if (Array.isArray(p.images)) return p.images[0] || brand.logo;
  try {
    const parsed = JSON.parse(p.images || '[]');
    return parsed[0] || brand.logo;
  } catch (e) {
    return p.images || brand.logo;
  }
};

// Fetch orders list
const loadOrders = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      ordersList.value = await res.json();
    } else {
      if (res.status === 401 || res.status === 403) {
        handleLogout();
      } else {
        errorMsg.value = 'Failed to load customer orders.';
      }
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
    errorMsg.value = 'Server network error occurred while loading orders.';
  } finally {
    isLoading.value = false;
  }
};

// Fetch statistics
const loadStats = async () => {
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch('/api/admin/orders/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      stats.value = await res.json();
    }
  } catch (err) {
    console.error('Error loading order statistics:', err);
  }
};

onMounted(async () => {
  await loadProducts();
  await loadOrders();
  await loadStats();
});

const handleLogout = () => {
  localStorage.removeItem('sureplug_admin_token');
  localStorage.removeItem('sureplug_admin_authenticated');
  router.push('/admin/login');
};

// Mask phone number: 080****1234
const maskPhone = (phone) => {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length < 7) return clean;
  return clean.slice(0, 3) + '****' + clean.slice(-4);
};

// Format items summary list: Product1, Product2 (3 items)
const getItemsSummary = (itemsJson) => {
  try {
    const items = JSON.parse(itemsJson || '[]');
    const names = items.map(item => item.title);
    const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);
    if (names.length === 0) return 'No items';
    if (names.length === 1) return `${names[0]} (x${totalCount})`;
    return `${names[0]}, ${names[1]}${names.length > 2 ? '...' : ''} (${totalCount} items)`;
  } catch (e) {
    return 'Unreadable items payload';
  }
};

// Format Currency
const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

// Client-side filtration
const filteredOrders = computed(() => {
  return ordersList.value.filter(order => {
    // Search filter: customer name, email, or order reference
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchName = (order.customer_name || '').toLowerCase().includes(q);
      const matchEmail = (order.customer_email || '').toLowerCase().includes(q);
      const matchRef = (order.payment_reference || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchRef) return false;
    }

    // Payment Status filter
    if (filterPaymentStatus.value !== 'all') {
      if ((order.payment_status || '').toLowerCase() !== filterPaymentStatus.value.toLowerCase()) {
        return false;
      }
    }

    // Fulfillment Status filter
    if (filterFulfillmentStatus.value !== 'all') {
      if ((order.fulfillment_status || '').toLowerCase() !== filterFulfillmentStatus.value.toLowerCase()) {
        return false;
      }
    }

    // Date Range filter
    if (startDate.value) {
      const oDate = new Date(order.created_at);
      const sDate = new Date(startDate.value);
      sDate.setHours(0, 0, 0, 0);
      if (oDate < sDate) return false;
    }
    if (endDate.value) {
      const oDate = new Date(order.created_at);
      const eDate = new Date(endDate.value);
      eDate.setHours(23, 59, 59, 999);
      if (oDate > eDate) return false;
    }

    return true;
  });
});

// Row selection details modal handler
const viewOrderDetails = (order) => {
  let items = [];
  try {
    items = JSON.parse(order.items_json || '[]');
  } catch (e) {
    console.error('Error parsing items JSON for detail modal:', e);
  }
  selectedOrder.value = {
    ...order,
    items
  };
  isModalOpen.value = true;
};

// Fulfillment status update caller
const changeFulfillmentStatus = async (newStatus) => {
  if (!selectedOrder.value) return;
  isUpdatingFulfillment.value = true;
  
  const token = localStorage.getItem('sureplug_admin_token');
  try {
    const res = await fetch(`/api/admin/orders/${selectedOrder.value.id}/fulfillment`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (res.ok) {
      // Update local state in-place
      selectedOrder.value.fulfillment_status = newStatus.toLowerCase();
      selectedOrder.value.status = newStatus.toLowerCase();
      
      // Update orders in the background
      await loadOrders();
      await loadStats();
    } else {
      alert('Failed to update fulfillment status.');
    }
  } catch (err) {
    console.error('Fulfillment update error:', err);
    alert('Network error updating fulfillment state.');
  } finally {
    isUpdatingFulfillment.value = false;
  }
};

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

const totalPages = computed(() => {
  return Math.ceil(filteredOrders.value.length / itemsPerPage.value);
});

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredOrders.value.slice(start, end);
});

// Watcher to reset currentPage when filters change
watch([searchQuery, filterPaymentStatus, filterFulfillmentStatus, startDate, endDate], () => {
  currentPage.value = 1;
});

// Watch modal state to block background body scrolling
watch(isModalOpen, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <div class="page-wrapper admin-orders-view">
    <div class="animate-fade-in">
    <div class="orders-header-row">
      <div>
        <h1 class="orders-title">Order Management</h1>
        <p class="orders-subtitle">Process checkouts, inspect shipping manifests, and manage delivery handshakes.</p>
      </div>
      <button class="btn btn-outlined refresh-btn" @click="loadOrders(); loadStats();">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Sync Orders
      </button>
    </div>

    <!-- Live Aggregated Statistics Row -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon active-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <div class="metric-info">
          <span class="metric-val">{{ stats.ordersToday }}</span>
          <span class="metric-label">Orders Today</span>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon active-icon green-variant">
          <span style="font-size: 14px; font-weight: 800;">₦</span>
        </div>
        <div class="metric-info">
          <span class="metric-val">{{ formatPrice(stats.revenueToday) }}</span>
          <span class="metric-label">Revenue Today</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon warning-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div class="metric-info">
          <span class="metric-val">{{ stats.pendingFulfillments }}</span>
          <span class="metric-label">Pending Fulfillments</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon info-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div class="metric-info">
          <span class="metric-val">{{ stats.deliveredAllTime }}</span>
          <span class="metric-label">Delivered All-Time</span>
        </div>
      </div>
    </div>

    <!-- Controls Panel: Search & Filters -->
    <div class="console-panel">
      <div class="console-controls-row">
        <!-- Search bar -->
        <div class="console-search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search name, email, or ref..." 
            class="form-input console-search-input" 
          />
        </div>

        <!-- Filter items -->
        <div class="console-filters-wrapper">
          <div class="console-filter-item">
            <span class="filter-label">Payment:</span>
            <select v-model="filterPaymentStatus" class="console-filter-select">
              <option value="all">All States</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div class="console-filter-item">
            <span class="filter-label">Fulfillment:</span>
            <select v-model="filterFulfillmentStatus" class="console-filter-select">
              <option value="all">All States</option>
              <option value="unfulfilled">Unfulfilled</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="fulfillment_failed">Failed</option>
            </select>
          </div>

          <!-- Date Filters -->
          <div class="console-filter-item date-filter-item">
            <span class="filter-label">Range:</span>
            <div class="date-inputs">
              <input type="date" v-model="startDate" class="console-filter-select date-input-box" placeholder="Start" />
              <span class="date-range-sep">to</span>
              <input type="date" v-model="endDate" class="console-filter-select date-input-box" placeholder="End" />
            </div>
          </div>
        </div>
      </div>

      <!-- Orders listing table -->
      <div v-if="isLoading" class="table-loading-overlay">
        <span class="table-spinner"></span>
        <p>Loading manifests from registry...</p>
      </div>

      <div v-else-if="errorMsg" class="table-error-box">
        <p>{{ errorMsg }}</p>
        <button class="btn btn-navy" @click="loadOrders">Retry Connection</button>
      </div>

      <div v-else class="table-responsive">
        <table class="products-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items Summary</th>
              <th>Total Amount</th>
              <th>Payment</th>
              <th>Fulfillment</th>
              <th>Method</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="ordersList.length === 0">
              <td colspan="9" class="no-records-cell" style="text-align: center; color: var(--color-muted); padding: 48px 24px;">
                No orders yet. They will appear here once customers start checking out.
              </td>
            </tr>
            <tr v-else-if="filteredOrders.length === 0">
              <td colspan="9" class="no-records-cell" style="text-align: center; padding: 24px;">
                No checkout orders match your query criteria.
              </td>
            </tr>
            <tr 
              v-for="order in paginatedOrders" 
              :key="order.id" 
              class="clickable-order-row"
              @click="viewOrderDetails(order)"
            >
              <td>
                <span class="font-semibold text-purple">#{{ order.id }}</span>
              </td>
              <td>
                <div class="customer-info-cell">
                  <span class="customer-name font-semibold">{{ order.customer_name }}</span>
                  <span class="customer-phone text-xs text-muted">{{ maskPhone(order.customer_phone) }}</span>
                </div>
              </td>
              <td>
                <span class="items-summary-text">{{ getItemsSummary(order.items_json) }}</span>
              </td>
              <td class="price-cell font-semibold">
                {{ formatPrice(order.total_amount) }}
              </td>
              <td>
                <span class="badge-status font-bold" :class="`pay-status-${(order.payment_status || '').toLowerCase()}`">
                  {{ order.payment_status }}
                </span>
              </td>
              <td>
                <span class="badge-status font-bold" :class="`ful-status-${(order.fulfillment_status || '').toLowerCase()}`">
                  {{ order.fulfillment_status }}
                </span>
              </td>
              <td>
                <span class="delivery-method-label">{{ (order.delivery_method || 'standard').toUpperCase() }}</span>
              </td>
              <td class="created-at-cell text-muted">
                {{ new Date(order.created_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' }) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div class="pagination-controls-row" v-if="totalPages > 1">
        <button 
          class="btn btn-outlined pagination-btn" 
          :disabled="currentPage === 1" 
          @click="currentPage--"
        >
          ← Previous
        </button>
        <span class="pagination-info">
          Page <strong>{{ currentPage }}</strong> of <strong>{{ totalPages }}</strong>
        </span>
        <button 
          class="btn btn-outlined pagination-btn" 
          :disabled="currentPage === totalPages" 
          @click="currentPage++"
        >
          Next →
        </button>
      </div>
    </div>
  </div>

    <!-- Expand Detailed Order Modal Drawer -->
    <div v-if="isModalOpen && selectedOrder" class="modal-overlay" @click.self="isModalOpen = false">
      <div class="modal-card modal-card-large animate-fade-in">
        <div class="modal-header">
          <h3>Order Manifest: <span class="text-purple">#{{ selectedOrder.id }}</span></h3>
          <button class="modal-close-btn" @click="isModalOpen = false">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Summary info header -->
          <div class="modal-section-grid">
            <!-- Customer -->
            <div class="info-block">
              <h4 class="modal-sub-label">Customer Profile</h4>
              <p><strong>Full Name:</strong> {{ selectedOrder.customer_name }}</p>
              <p><strong>Unmasked Phone:</strong> {{ selectedOrder.customer_phone }}</p>
              <p><strong>Email Address:</strong> {{ selectedOrder.customer_email }}</p>
            </div>

            <!-- Shipping -->
            <div class="info-block">
              <h4 class="modal-sub-label">Shipping Profile</h4>
              <p><strong>Address:</strong> {{ selectedOrder.delivery_address }}</p>
              <p v-if="selectedOrder.delivery_landmark"><strong>Landmark:</strong> {{ selectedOrder.delivery_landmark }}</p>
              <p><strong>State:</strong> {{ selectedOrder.delivery_state }}</p>
              <p><strong>Method:</strong> {{ selectedOrder.delivery_method.toUpperCase() }}</p>
            </div>

            <!-- Settlement info -->
            <div class="info-block">
              <h4 class="modal-sub-label">Gateway Details</h4>
              <p><strong>Reference:</strong> <span class="mono-ref">{{ selectedOrder.payment_reference }}</span></p>
              <p><strong>Gateway Transaction ID:</strong> <span class="mono-ref">{{ selectedOrder.provider_transaction_id || 'N/A' }}</span></p>
              <p><strong>Overall Status:</strong> {{ selectedOrder.status.toUpperCase() }}</p>
            </div>
          </div>

          <!-- Items list showing product thumbnails -->
          <div class="modal-items-section">
            <h4 class="modal-sub-label">Itemized Manifest</h4>
            <div class="modal-items-table-wrapper">
              <table class="modal-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedOrder.items" :key="item.id">
                    <td class="modal-item-info">
                      <img :src="getProductImage(item.id)" class="modal-product-thumbnail" />
                      <div class="item-meta">
                        <span class="item-title font-semibold">{{ item.title }}</span>
                        <span class="item-id-tag">ID: #{{ item.id }}</span>
                      </div>
                    </td>
                    <td>{{ formatPrice(item.price) }}</td>
                    <td>{{ item.quantity }}</td>
                    <td class="font-semibold">{{ formatPrice(item.price * item.quantity) }}</td>
                  </tr>
                  <tr class="modal-total-row">
                    <td colspan="3" class="text-right"><strong>Subtotal:</strong></td>
                    <td class="font-semibold">{{ formatPrice(selectedOrder.total_amount - (selectedOrder.delivery_method === 'express' ? 2500 : 0)) }}</td>
                  </tr>
                  <tr class="modal-total-row">
                    <td colspan="3" class="text-right"><strong>Delivery Fee:</strong></td>
                    <td class="font-semibold">{{ formatPrice(selectedOrder.delivery_method === 'express' ? 2500 : 0) }}</td>
                  </tr>
                  <tr class="modal-total-row final-row">
                    <td colspan="3" class="text-right"><strong>Grand Total:</strong></td>
                    <td class="font-bold text-purple">{{ formatPrice(selectedOrder.total_amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Status timelines & Fulfillment state updater -->
          <div class="fulfillment-controls-block">
            <h4 class="modal-sub-label">Fulfillment Controls</h4>
            <div class="fulfillment-row-container">
              <div class="status-indicator">
                <span>Current fulfillment status: </span>
                <span class="status-tag" :class="`ful-status-${selectedOrder.fulfillment_status}`">
                  {{ selectedOrder.fulfillment_status.toUpperCase() }}
                </span>
              </div>
              
              <!-- Progress flow button triggers -->
              <div class="btn-group-fulfillment">
                <button 
                  class="btn btn-outlined status-step-btn" 
                  :class="{ active: selectedOrder.fulfillment_status === 'pending' }"
                  :disabled="isUpdatingFulfillment"
                  @click="changeFulfillmentStatus('pending')"
                >
                  Pending
                </button>
                <button 
                  class="btn btn-outlined status-step-btn" 
                  :class="{ active: selectedOrder.fulfillment_status === 'processing' }"
                  :disabled="isUpdatingFulfillment"
                  @click="changeFulfillmentStatus('processing')"
                >
                  Processing
                </button>
                <button 
                  class="btn btn-outlined status-step-btn" 
                  :class="{ active: selectedOrder.fulfillment_status === 'shipped' }"
                  :disabled="isUpdatingFulfillment"
                  @click="changeFulfillmentStatus('shipped')"
                >
                  Shipped
                  <svg class="status-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-left: 4px;">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </button>
                <button 
                  class="btn btn-outlined status-step-btn" 
                  :class="{ active: selectedOrder.fulfillment_status === 'delivered' }"
                  :disabled="isUpdatingFulfillment"
                  @click="changeFulfillmentStatus('delivered')"
                >
                  Delivered
                </button>
              </div>
            </div>
            <p class="fulfillment-info-tip" v-if="selectedOrder.fulfillment_status === 'shipped'" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-yellow); flex-shrink: 0;">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                <line x1="9" y1="18" x2="15" y2="18"></line>
                <line x1="10" y1="22" x2="14" y2="22"></line>
              </svg>
              <span>Transitioning to <strong>Shipped</strong> triggers a customer dispatch email in the background.</span>
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-navy" @click="isModalOpen = false">Close Manifest</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-orders-view {
  margin-top: 40px;
  margin-bottom: 80px;
}

.orders-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.orders-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--color-slate-headings);
}

.orders-subtitle {
  font-size: 14.5px;
  color: var(--color-muted-grey);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  padding: 10px 18px;
}

/* Metrics Dashboard cards */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
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
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
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

.active-icon { 
  background-color: var(--color-green-bg); 
  color: var(--color-green); 
}

.green-variant {
  background-color: #E8F5E9;
  color: #10B981;
}

.warning-icon { 
  background-color: var(--color-orange-bg); 
  color: var(--color-orange); 
}

.info-icon {
  background-color: #EFF6FF;
  color: var(--color-purple);
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-val {
  font-family: var(--font-body);
  font-size: 20px;
  font-weight: 800;
  color: var(--color-slate-headings);
  line-height: 1.1;
}

.metric-label {
  font-size: 12px;
  color: var(--color-muted-grey);
  font-weight: 600;
  margin-top: 2px;
}

/* Console Panel Controls */
.console-panel {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}

.console-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.console-search-box {
  position: relative;
  width: 280px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 13px;
  color: var(--color-muted-grey);
}

.console-search-input {
  padding-left: 36px;
  font-size: 13px;
  height: 40px;
}

.console-filters-wrapper {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.console-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-slate-headings);
  white-space: nowrap;
}

.console-filter-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-bg);
  font-size: 13px;
  color: var(--color-slate-body);
  outline: none;
  min-width: 120px;
  height: 40px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.console-filter-select:focus {
  border-color: var(--color-navy);
  background-color: var(--color-white);
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input-box {
  padding: 6px 8px;
  font-size: 12.5px;
  width: 125px;
}

.date-range-sep {
  font-size: 12px;
  color: var(--color-muted-grey);
}

/* Products Table Styles */
.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  text-align: left;
}

.products-table th {
  padding: 14px 16px;
  background-color: var(--color-bg);
  color: var(--color-slate-headings);
  font-weight: 700;
  border-bottom: 2px solid var(--color-border-light);
}

.products-table td {
  padding: 16px;
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

.clickable-order-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clickable-order-row:hover {
  background-color: rgba(99, 102, 241, 0.03);
}

.customer-info-cell {
  display: flex;
  flex-direction: column;
}

.customer-name {
  color: var(--color-slate-headings);
}

.items-summary-text {
  max-width: 250px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-slate-body);
}

.badge-status {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Payment badges styling */
.pay-status-paid { background-color: #E8F5E9; color: #16A34A; }
.pay-status-pending { background-color: #FFF3E0; color: #EA580C; }
.pay-status-failed { background-color: #FEE2E2; color: #EF4444; }

/* Fulfillment badges styling */
.ful-status-unfulfilled { background-color: #F1F5F9; color: #64748B; }
.ful-status-pending { background-color: #FFF3E0; color: #EA580C; }
.ful-status-processing { background-color: #EFF6FF; color: #2563EB; }
.ful-status-shipped { background-color: #F5F3FF; color: #7C3AED; }
.ful-status-delivered { background-color: #E8F5E9; color: #16A34A; }
.ful-status-fulfillment_failed { background-color: #FEE2E2; color: #EF4444; }

.delivery-method-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-muted-grey);
}

/* Loading & error indicators */
.table-loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 16px;
  color: var(--color-muted-grey);
}

.table-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(99, 102, 241, 0.1);
  border-top-color: var(--color-purple);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table-error-box {
  padding: 40px;
  text-align: center;
  color: var(--color-red);
}

/* Modal details */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card-large {
  width: 100%;
  max-width: 800px;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-card {
  background-color: var(--color-white);
  border-radius: 16px;
  border: 1px solid var(--color-border-light);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 28px;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-slate-headings);
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-muted-grey);
  transition: color 0.2s ease;
}

.modal-close-btn:hover {
  color: var(--color-slate-headings);
}

.modal-body {
  padding: 28px;
  overflow-y: auto;
}

.modal-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.info-block h4 {
  margin-bottom: 10px;
}

.modal-sub-label {
  font-size: 13.5px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-muted-grey);
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--color-border-light);
  padding-bottom: 6px;
}

.info-block p {
  font-size: 13.5px;
  margin: 6px 0;
  color: var(--color-slate-body);
}

.mono-ref {
  font-family: monospace;
  font-size: 12.5px;
  background-color: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Itemized table */
.modal-items-section {
  margin-bottom: 32px;
}

.modal-items-table-wrapper {
  margin-top: 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  overflow: hidden;
}

.modal-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.modal-items-table th {
  padding: 10px 16px;
  background-color: var(--color-bg);
  color: var(--color-navy);
  font-weight: 700;
  text-align: left;
}

.modal-items-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-slate-body);
}

.modal-item-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-product-thumbnail {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: 2px;
}

.item-meta {
  display: flex;
  flex-direction: column;
}

.item-id-tag {
  font-size: 11px;
  color: var(--color-muted-grey);
}

.modal-total-row td {
  background-color: var(--color-bg);
  border-bottom: 1px solid rgba(0,0,0,0.03);
  font-size: 13px;
  color: var(--color-muted-grey);
}

.modal-total-row.final-row td {
  font-size: 14.5px;
  color: var(--color-navy);
  border-bottom: none;
}

/* Fulfillment control actions list */
.fulfillment-controls-block {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 20px;
}

.fulfillment-row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 10px;
}

.status-indicator {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-tag {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
}

.btn-group-fulfillment {
  display: flex;
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 4px;
}

.status-step-btn {
  border: none;
  background: none;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 600;
  color: var(--color-muted-grey);
}

.status-step-btn:hover {
  background-color: var(--color-bg);
  color: var(--color-navy);
}

.status-step-btn.active {
  background-color: var(--color-navy);
  color: var(--color-white);
}

.fulfillment-info-tip {
  font-size: 12.5px;
  color: var(--color-muted-grey);
  margin-top: 12px;
}

.modal-footer {
  padding: 16px 28px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
  background-color: var(--color-bg);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

@media (max-width: 768px) {
  .orders-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .console-controls-row {
    flex-direction: column;
    align-items: stretch;
  }
  .console-search-box {
    width: 100%;
  }
  .console-filters-wrapper {
    flex-direction: column;
    align-items: stretch;
  }
  .console-filter-select {
    width: 100%;
  }
  .date-inputs {
    flex-direction: column;
    align-items: stretch;
  }
  .date-input-box {
    width: 100%;
  }
}
/* Pagination Controls */
.pagination-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-light);
}

.pagination-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pagination-info {
  font-size: 13.5px;
  color: var(--color-muted-grey);
}

.pagination-info strong {
  color: var(--color-slate-headings);
}
</style>
