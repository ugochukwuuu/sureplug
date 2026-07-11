<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const order = ref(null);
const isLoading = ref(true);
const errorMsg = ref('');

const fetchOrderDetails = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  
  try {
    const reference = route.params.reference;
    if (!reference) {
      errorMsg.value = 'Missing order reference.';
      isLoading.value = false;
      return;
    }

    const response = await fetch(`/api/orders/track/${reference}`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      order.value = data.order;
    } else {
      errorMsg.value = data.error || 'Failed to retrieve order details.';
    }
  } catch (err) {
    console.error('Error fetching order details:', err);
    errorMsg.value = 'Failed to connect to the server. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchOrderDetails();
});

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Map fulfillment statuses to step indices
const steps = [
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' }
];

const getStepClass = (stepKey, currentStatus) => {
  const statusOrder = ['pending', 'processing', 'shipped', 'delivered', 'fulfillment_failed'];
  const currentIdx = statusOrder.indexOf(currentStatus);
  const stepIdx = statusOrder.indexOf(stepKey);
  
  if (currentStatus === 'fulfillment_failed') {
    return stepKey === 'pending' ? 'completed error' : 'inactive';
  }

  if (currentIdx >= stepIdx) {
    return currentIdx === stepIdx ? 'active' : 'completed';
  }
  return 'inactive';
};

const getPaymentBadgeClass = (status) => {
  if (status === 'paid') return 'badge-green';
  if (status === 'pending') return 'badge-amber';
  return 'badge-red';
};
</script>

<template>
  <div class="track-order-view page-wrapper animate-fade-in">
    <!-- Header -->
    <header class="tracking-header">
      <div class="tracking-header-content">
        <h1 class="logo-text">Sureplug</h1>
        <p class="tagline">Authentic tech. Trusted people. Zero stress.</p>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Locating order status details...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="errorMsg" class="error-container card animate-fade-in">
      <div class="error-icon">🔍</div>
      <h2>Order Not Found</h2>
      <p class="error-text">{{ errorMsg }}</p>
      <button class="btn btn-yellow" @click="router.push('/')">Go to Marketplace</button>
    </div>

    <!-- Main Content -->
    <div v-else-if="order" class="tracking-content-grid">
      <!-- Left side: Order tracking card -->
      <main class="tracking-main-panel">
        <section class="card tracking-status-card">
          <div class="tracking-status-header">
            <div>
              <span class="lbl-light">ORDER REFERENCE</span>
              <h2 class="ref-text">{{ order.reference }}</h2>
            </div>
            <div>
              <span class="lbl-light">PAYMENT STATUS</span>
              <div class="status-badge" :class="getPaymentBadgeClass(order.paymentStatus)">
                {{ order.paymentStatus.toUpperCase() }}
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Step progress indicator -->
          <div class="fulfillment-tracker">
            <h3 class="tracker-title">Fulfillment Progress</h3>
            
            <div class="tracker-steps-container">
              <div 
                v-for="(step, idx) in steps" 
                :key="step.key" 
                class="tracker-step"
                :class="getStepClass(step.key, order.fulfillmentStatus)"
              >
                <!-- Line connector -->
                <div v-if="idx > 0" class="step-line-connector"></div>
                
                <div class="step-node">
                  <span class="step-dot"></span>
                  <span class="step-num" v-if="getStepClass(step.key, order.fulfillmentStatus) !== 'completed'">{{ idx + 1 }}</span>
                  <span class="step-check" v-else>✓</span>
                </div>
                <span class="step-lbl">{{ step.label }}</span>
              </div>
            </div>

            <!-- Exception warning for failed fulfillment -->
            <div v-if="order.fulfillmentStatus === 'fulfillment_failed'" class="fulfillment-alert warning">
              <strong>Logistics Notice:</strong> Payment was received, but the items in your order went out of stock before settlement could complete. Our customer support will contact you shortly to arrange a direct refund or dispatch replacement stock.
            </div>
          </div>
        </section>

        <!-- Order Items -->
        <section class="card tracking-items-card">
          <h3 class="card-section-title">Order Items</h3>
          
          <div class="items-list">
            <div v-for="item in order.items" :key="item.id" class="tracking-item-row">
              <img :src="item.image || '/src/assets/logo.png'" alt="product image" class="item-img" />
              <div class="item-details">
                <h4 class="item-title">{{ item.title }}</h4>
                <div class="item-meta">
                  <span class="item-qty">Quantity: {{ item.quantity }}</span>
                  <span class="item-price">{{ formatPrice(item.price) }}</span>
                </div>
              </div>
              <div class="item-total">
                {{ formatPrice(item.price * item.quantity) }}
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- Right side: Delivery Info Card -->
      <aside class="tracking-side-panel">
        <section class="card delivery-details-card">
          <h3 class="card-section-title">Delivery Details</h3>
          
          <div class="delivery-details-list">
            <div class="detail-row">
              <span class="detail-lbl">Recipient Name</span>
              <span class="detail-val">{{ order.customerName }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Contact Phone</span>
              <span class="detail-val">{{ order.customerPhone }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Delivery Address</span>
              <span class="detail-val">{{ order.deliveryAddress }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">State</span>
              <span class="detail-val">{{ order.deliveryState }}</span>
            </div>
            <div v-if="order.deliveryLandmark" class="detail-row">
              <span class="detail-lbl">Landmark</span>
              <span class="detail-val">{{ order.deliveryLandmark }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Delivery Method</span>
              <span class="detail-val capitalize">{{ order.deliveryMethod }} Delivery</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Timeframe</span>
              <span class="detail-val font-semibold text-green">1-2 Days (Est.)</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Order Placed</span>
              <span class="detail-val">{{ formatDate(order.createdAt) }}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.track-order-view {
  margin-top: 32px;
  margin-bottom: 80px;
}

/* Header styled with brand Indigo */
.tracking-header {
  background-color: var(--color-navy);
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  margin-bottom: 32px;
  color: var(--color-white);
  box-shadow: 0 4px 20px rgba(30, 14, 98, 0.15);
}

.logo-text {
  font-family: var(--font-display);
  font-size: 36px;
  color: var(--color-yellow);
  margin-bottom: 8px;
}

.tagline {
  font-size: 14px;
  opacity: 0.9;
}

/* Loading & Error */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  color: var(--color-muted-grey);
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(30, 14, 98, 0.1);
  border-top-color: var(--color-yellow);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container {
  max-width: 500px;
  margin: 40px auto;
  text-align: center;
  padding: 40px 32px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-text {
  color: var(--color-red);
  margin-bottom: 24px;
}

/* Tracking Card UI */
.card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.tracking-content-grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 32px;
}

@media (max-width: 992px) {
  .tracking-content-grid {
    grid-template-columns: 1fr;
  }
}

.tracking-status-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
}

.lbl-light {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--color-muted-grey);
  display: block;
  margin-bottom: 6px;
}

.ref-text {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 700;
  word-break: break-all;
}

.divider {
  height: 1px;
  background-color: var(--color-border-light);
  margin: 20px 0;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
}

.badge-green {
  background-color: var(--color-green-bg);
  color: var(--color-green);
}

.badge-amber {
  background-color: var(--color-orange-bg);
  color: var(--color-gold);
}

.badge-red {
  background-color: #FEE2E2;
  color: var(--color-red);
}

/* Step fulfillment progress */
.fulfillment-tracker {
  margin-top: 16px;
}

.tracker-title {
  font-size: 16px;
  margin-bottom: 24px;
}

.tracker-steps-container {
  display: flex;
  justify-content: space-between;
  position: relative;
  margin-bottom: 24px;
}

.tracker-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
  text-align: center;
}

.step-node {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--color-white);
  border: 2px solid var(--color-border-light);
  color: var(--color-muted-grey);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  position: relative;
  z-index: 2;
  transition: all 0.3s ease;
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-muted-grey);
  display: none;
}

.step-lbl {
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
  color: var(--color-muted-grey);
}

.step-line-connector {
  position: absolute;
  top: 14px;
  right: 50%;
  width: 100%;
  height: 2px;
  background-color: var(--color-border-light);
  z-index: 1;
}

/* Step classes (Completed, Active, Inactive) */
.tracker-step.completed .step-node {
  background-color: var(--color-yellow);
  border-color: var(--color-yellow);
  color: var(--color-navy);
}

.tracker-step.completed .step-lbl {
  color: var(--color-slate-headings);
}

.tracker-step.completed .step-line-connector {
  background-color: var(--color-yellow);
}

.tracker-step.active .step-node {
  border-color: var(--color-yellow);
  color: var(--color-yellow);
  background-color: var(--color-white);
}

.tracker-step.active .step-lbl {
  color: var(--color-yellow);
  font-weight: 700;
}

.tracker-step.active .step-line-connector {
  background-color: var(--color-yellow);
}

.tracker-step.completed.error .step-node {
  background-color: var(--color-red);
  border-color: var(--color-red);
  color: var(--color-white);
}

.tracker-step.completed.error .step-lbl {
  color: var(--color-red);
}

.fulfillment-alert {
  padding: 14px 18px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 16px;
}

.fulfillment-alert.warning {
  background-color: var(--color-orange-bg);
  border-left: 4px solid var(--color-orange);
  color: var(--color-slate-body);
}

/* Order Items */
.card-section-title {
  font-size: 18px;
  margin-bottom: 20px;
  border-bottom: 2px solid var(--color-lavender);
  padding-bottom: 8px;
}

.tracking-item-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.tracking-item-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.item-img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
}

.item-details {
  flex: 1;
}

.item-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.item-meta {
  font-size: 12px;
  color: var(--color-muted-grey);
}

.item-qty {
  margin-right: 12px;
}

.item-total {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-slate-headings);
}

/* Delivery details side panel */
.delivery-details-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-muted-grey);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail-val {
  font-size: 14px;
  color: var(--color-slate-headings);
  line-height: 1.4;
}

.capitalize {
  text-transform: capitalize;
}
</style>
