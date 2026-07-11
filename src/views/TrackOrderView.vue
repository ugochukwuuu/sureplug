<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { brand } from '@/config/brand.js';

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
        <h1 class="logo-text">{{ brand.name }}</h1>
        <p class="tagline">{{ brand.tagline }}</p>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Locating order status details...</p>
    </div>

    <!-- Error state (Styled Empty State) -->
    <div v-else-if="errorMsg" class="empty-state animate-fade-in">
      <h2 class="empty-headline">Order not found.</h2>
      <p class="empty-subtext">Double-check your order reference or contact us on WhatsApp.</p>
      <a :href="`https://wa.me/${brand.supportPhone?.replace(/\D/g, '')}`" target="_blank" class="btn btn-yellow whatsapp-btn">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 1.98 14.117.953 11.487.953c-5.412 0-9.819 4.364-9.824 9.795-.002 1.8.487 3.562 1.418 5.12L2.094 21.8l6.082-1.586c-1.513.918-1.513.918-.04 1.564zM17.65 14.6c-.3-.15-1.774-.874-2.048-.974-.274-.1-.474-.15-.674.15-.2.3-.774.974-.948 1.174-.174.2-.35.225-.65.075-.3-.15-1.263-.465-2.407-1.485-.89-.795-1.49-1.777-1.664-2.077-.174-.3-.018-.463.13-.61.134-.133.3-.349.45-.524.15-.175.2-.3.3-.5s.05-.375-.025-.525C9.9 8.8 9.3 7.348 9.05 6.748c-.244-.588-.492-.507-.674-.516-.174-.008-.374-.01-.574-.01-.2 0-.525.075-.8.375-.274.3-1.048 1.024-1.048 2.5s1.074 2.9 1.224 3.1c.15.2 2.11 3.22 5.116 4.52 1.63.708 2.22.775 3.018.66.788-.115 1.774-.725 2.024-1.399.25-.675.25-1.25.174-1.399-.074-.15-.274-.225-.574-.375z"/>
        </svg>
        <span>Contact on WhatsApp</span>
      </a>
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
              <img :src="item.image || brand.logo" alt="product image" class="item-img" />
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

/* Empty state styling */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 24px;
  background-color: var(--color-white);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border-light);
  max-width: 600px;
  margin: 40px auto;
}
.empty-headline {
  font-family: var(--font-display), serif;
  font-size: 2.25rem;
  color: var(--color-navy);
  margin-bottom: 12px;
}
.empty-subtext {
  font-family: var(--font-body), sans-serif;
  font-size: 1rem;
  color: var(--color-muted-grey);
  margin-bottom: 24px;
  max-width: 450px;
}
.whatsapp-btn {
  font-size: 15px;
  padding: 12px 28px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}
</style>
