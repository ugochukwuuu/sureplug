<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCartStore } from '../stores/cart';
import { useRouter, useRoute } from 'vue-router';
import { brandConfig as brand } from '@/services/brandService.js';

const cartStore = useCartStore();
const router = useRouter();
const route = useRoute();

// Step 1: Cart, Step 2: Delivery, Step 3: Payment/Success
const activeStep = ref(2); 
const isPromoOpen = ref(false);
const promoInput = ref('');
const promoMessage = ref('');
const isOrderCompleted = ref(false);

const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const idempotencyKey = ref(generateUUID());

// Payment verification states
const isVerifying = ref(false);
const verifyReference = ref('');
const verifyError = ref('');
const pollingTimer = ref(null);
const pollingCount = ref(0);
const maxPolls = 60; // 2 minutes (60 * 2s)

const startPolling = () => {
  isVerifying.value = true;
  verifyError.value = '';
  pollingCount.value = 0;
  
  if (pollingTimer.value) clearInterval(pollingTimer.value);

  pollingTimer.value = setInterval(async () => {
    pollingCount.value++;
    if (pollingCount.value > maxPolls) {
      clearInterval(pollingTimer.value);
      isVerifying.value = false;
      verifyError.value = "We're still verifying your payment. It might take a bit longer. If you have been debited, please refresh status manually.";
      return;
    }
    
    try {
      const res = await fetch(`/api/checkout/status?reference=${verifyReference.value}`);
      if (res.ok) {
        const data = await res.json();
        if (data.paymentStatus === 'paid') {
          clearInterval(pollingTimer.value);
          isVerifying.value = false;
          isOrderCompleted.value = true;
          cartStore.clearCart();
          idempotencyKey.value = generateUUID();
        } else if (data.paymentStatus === 'failed') {
          clearInterval(pollingTimer.value);
          isVerifying.value = false;
          verifyError.value = 'Your payment attempt was marked as failed. Please check with your bank or try again.';
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 2000);
};

const checkStatusManually = async () => {
  isVerifying.value = true;
  verifyError.value = '';
  try {
    const res = await fetch(`/api/checkout/status?reference=${verifyReference.value}`);
    if (res.ok) {
      const data = await res.json();
      if (data.paymentStatus === 'paid') {
        isVerifying.value = false;
        isOrderCompleted.value = true;
        cartStore.clearCart();
        idempotencyKey.value = generateUUID();
      } else {
        isVerifying.value = false;
        verifyError.value = 'We could not confirm your payment yet. If you have been debited, please wait a moment and try again.';
      }
    } else {
      isVerifying.value = false;
      verifyError.value = 'Failed to check status. Network issue.';
    }
  } catch (err) {
    isVerifying.value = false;
    verifyError.value = 'Network error checking payment status.';
  }
};

onMounted(() => {
  if (route.query.verifying === 'true' && route.query.reference) {
    let refVal = route.query.reference;
    if (Array.isArray(refVal)) {
      refVal = refVal.find(r => r.trim() !== '') || '';
    } else if (typeof refVal === 'string' && refVal.includes(',')) {
      refVal = refVal.split(',').find(r => r.trim() !== '') || '';
    }
    
    if (refVal) {
      activeStep.value = 3;
      verifyReference.value = refVal;
      startPolling();
    }
  }
});

const isSubmitting = ref(false);
const submitError = ref('');

// Delivery Form
const form = ref({
  fullName: '',
  phone: '',
  email: '',
  address: '',
  state: '',
  landmark: ''
});

const handlePromoApply = () => {
  if (!promoInput.value.trim()) return;
  const result = cartStore.applyPromoCode(promoInput.value);
  promoMessage.value = result.message;
  if (result.success) {
    promoInput.value = '';
  }
};

const handleDeliveryMethodChange = (method) => {
  cartStore.deliveryMethod = method;
};

// Complete purchase trigger
const submitOrder = async () => {
  // Validate basic delivery inputs
  if (!form.value.fullName || !form.value.phone || !form.value.address || !form.value.state) {
    alert('Please fill in all required delivery details.');
    return;
  }

  isSubmitting.value = true;
  submitError.value = '';

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cartItems: cartStore.cartItems,
        deliveryInfo: form.value,
        paymentMethod: 'card', // default to online payment via Korapay
        deliveryMethod: cartStore.deliveryMethod,
        idempotencyKey: idempotencyKey.value
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('Checkout session initialized successfully on backend.');
      if (data.checkoutUrl) {
        // Redirect browser to Kora Payment gateway
        window.location.href = data.checkoutUrl;
      } else {
        submitError.value = 'Payment session link could not be initialized.';
        isSubmitting.value = false;
      }
    } else {
      submitError.value = data.error || 'Failed to submit order. Please try again.';
      isSubmitting.value = false;
    }
  } catch (e) {
    console.error('Order submission failed:', e);
    submitError.value = 'Network error. Failed to submit order. Please try again.';
    isSubmitting.value = false;
  }
};

const continueShopping = () => {
  isOrderCompleted.value = false;
  activeStep.value = 2;
  router.push('/');
};

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};
</script>

<template>
  <div class="checkout-view page-wrapper">
    <!-- Progress Stepper -->
    <div class="checkout-progress-bar">
      <!-- Step 1: Cart -->
      <div class="step-indicator" :class="{ completed: true, active: false }">
        <div class="step-indicator-circle">
          <span>✓</span>
        </div>
        <span class="step-indicator-lbl">Cart</span>
      </div>
      <div class="step-indicator-connector" :class="{ active: true }"></div>
      
      <!-- Step 2: Checkout -->
      <div class="step-indicator" :class="{ completed: activeStep > 2 || isOrderCompleted, active: activeStep === 2 && !isOrderCompleted }">
        <div class="step-indicator-circle">
          <span v-if="activeStep > 2 || isOrderCompleted">✓</span>
          <span v-else>2</span>
        </div>
        <span class="step-indicator-lbl">Checkout</span>
      </div>
      <div class="step-indicator-connector" :class="{ active: activeStep > 2 || isOrderCompleted }"></div>

      <!-- Step 3: Confirmation -->
      <div class="step-indicator" :class="{ completed: false, active: activeStep === 3 || isOrderCompleted }">
        <div class="step-indicator-circle">
          <span>3</span>
        </div>
        <span class="step-indicator-lbl">Confirmation</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="cartStore.cartItems.length === 0 && !isOrderCompleted && !isVerifying && !verifyError" class="empty-checkout-state animate-fade-in">
      <div class="empty-checkout-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
      </div>
      <h2>Your cart is empty</h2>
      <p>Before checking out, select gadgets you would like to purchase from the Marketplace.</p>
      <router-link to="/marketplace" class="btn btn-yellow">Shop Gadgets</router-link>
    </div>

    <!-- MAIN CHECKOUT FLOW -->
    <div v-else-if="!isOrderCompleted && !isVerifying && !verifyError" class="checkout-grid">
      <!-- Left Column: Delivery Form & Payment options -->
      <div class="checkout-inputs-panel">
        <!-- Delivery info -->
        <section class="checkout-section-box">
          <h3 class="checkout-section-title">Delivery Information</h3>
          
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input v-model="form.fullName" type="text" placeholder="Enter your full name" class="form-input" />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input v-model="form.phone" type="text" placeholder="Enter your phone number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input v-model="form.email" type="email" placeholder="Enter your email address" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Delivery Address</label>
            <input v-model="form.address" type="text" placeholder="Enter your delivery address" class="form-input" />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">State</label>
              <select v-model="form.state" class="form-select">
                <option disabled value="">Select state</option>
                <option>Lagos State</option>
                <option>Ogun State</option>
                <option>Oyo State</option>
                <option>Abuja FCT</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nearest University or Landmark</label>
              <input v-model="form.landmark" type="text" placeholder="Enter nearest landmark" class="form-input" />
            </div>
          </div>

          <!-- Delivery options -->
          <div class="form-group">
            <label class="form-label">Delivery Method</label>
            <div class="delivery-methods-grid">
              <div 
                class="radio-card" 
                :class="{ selected: cartStore.deliveryMethod === 'standard' }" 
                @click="handleDeliveryMethodChange('standard')"
              >
                <div class="radio-circle"><span class="radio-inner-dot"></span></div>
                <div class="delivery-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon></svg>
                </div>
                <div class="delivery-card-text">
                  <span class="delivery-title">Standard Delivery</span>
                  <span class="delivery-eta">1-2 Days</span>
                  <span class="delivery-cost text-green">Free</span>
                </div>
              </div>

              <div 
                class="radio-card" 
                :class="{ selected: cartStore.deliveryMethod === 'express' }" 
                @click="handleDeliveryMethodChange('express')"
              >
                <div class="radio-circle"><span class="radio-inner-dot"></span></div>
                <div class="delivery-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 22 12 17 22 22 12 2"></polygon></svg>
                </div>
                <div class="delivery-card-text">
                  <span class="delivery-title">Express Delivery</span>
                  <span class="delivery-eta">Same Day</span>
                  <span class="delivery-cost">₦2,500</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Promo accordion -->
          <div class="promo-code-accordion">
            <button class="promo-toggle-btn" @click="isPromoOpen = !isPromoOpen">
              <span>Have a promo code?</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" :style="{ transform: isPromoOpen ? 'rotate(180deg)' : 'none' }"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            
            <div v-if="isPromoOpen" class="promo-input-container animate-fade-in">
              <input v-model="promoInput" type="text" placeholder="Enter promo code (e.g. SUG5)" class="form-input promo-text-field" />
              <button class="btn btn-yellow promo-apply-btn" @click="handlePromoApply">Apply</button>
            </div>
            <p v-if="promoMessage" class="promo-feedback-msg" :class="{ 'text-green': cartStore.promoCode }">{{ promoMessage }}</p>
          </div>

          <!-- Buy submit btn -->
          <div class="complete-purchase-row">
            <button :disabled="isSubmitting" class="btn btn-yellow complete-btn" @click="submitOrder">
              <span v-if="isSubmitting" class="loading-spinner"></span>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              {{ isSubmitting ? 'Preparing your payment...' : 'Complete Purchase' }}
            </button>
            <p v-if="submitError" class="checkout-submit-error animate-fade-in">{{ submitError }}</p>
          </div>

          <!-- WhatsApp Payment Alternative -->
          <div class="whatsapp-alternative-container">
            <div class="alternative-divider">
              <span class="divider-line"></span>
              <span class="divider-text">or</span>
              <span class="divider-line"></span>
            </div>
            
            <a 
              :href="`https://wa.me/${(brand.whatsapp_number || brand.support_phone)?.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(brand.brand_name)}%2C%20I%20want%20to%20place%20an%20order.%20Here%20are%20my%20details%3A`" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="btn-whatsapp-alt"
            >
              <svg class="whatsapp-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 1.98 14.117.953 11.487.953c-5.412 0-9.819 4.364-9.824 9.795-.002 1.8.487 3.562 1.418 5.12L2.094 21.8l6.082-1.586c-1.513.918-1.513.918-.04 1.564zM17.65 14.6c-.3-.15-1.774-.874-2.048-.974-.274-.1-.474-.15-.674.15-.2.3-.774.974-.948 1.174-.174.2-.35.225-.65.075-.3-.15-1.263-.465-2.407-1.485-.89-.795-1.49-1.777-1.664-2.077-.174-.3-.018-.463.13-.61.134-.133.3-.349.45-.524.15-.175.2-.3.3-.5s.05-.375-.025-.525C9.9 8.8 9.3 7.348 9.05 6.748c-.244-.588-.492-.507-.674-.516-.174-.008-.374-.01-.574-.01-.2 0-.525.075-.8.375-.274.3-1.048 1.024-1.048 2.5s1.074 2.9 1.224 3.1c.15.2 2.11 3.22 5.116 4.52 1.63.708 2.22.775 3.018.66.788-.115 1.774-.725 2.024-1.399.25-.675.25-1.25.174-1.399-.074-.15-.274-.225-.574-.375z"/>
              </svg>
              Complete order via WhatsApp
            </a>
            
            <p class="whatsapp-alt-subtext">
              Prefer to pay offline? Chat us on WhatsApp and we'll guide you through.
            </p>
          </div>
        </section>
      </div>

      <!-- Right Column: Order Invoice details -->
      <aside class="checkout-summary-panel">
        <div class="summary-card">
          <h3 class="summary-card-title">Order Summary</h3>
          
          <!-- Items List -->
          <div class="summary-items-list">
            <div v-for="item in cartStore.cartItems" :key="item.id" class="summary-item">
              <img :src="item.image" alt="item photo" class="summary-item-img" />
              <div class="summary-item-info">
                <h4 class="summary-item-title">{{ item.title }}</h4>
                <div class="summary-item-price-qty">
                  <span class="summary-price">{{ formatPrice(item.price) }}</span>
                  <div class="summary-qty-selector">
                    <button class="qty-adjust-btn" @click="cartStore.updateQuantity(item.id, item.quantity - 1)">−</button>
                    <span class="qty-adjust-count">{{ item.quantity }}</span>
                    <button class="qty-adjust-btn" @click="cartStore.updateQuantity(item.id, item.quantity + 1)">+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Totals -->
          <div class="summary-pricing-rows">
            <div class="price-row">
              <span class="price-lbl">Subtotal</span>
              <span class="price-val">{{ formatPrice(cartStore.subtotal) }}</span>
            </div>
            <div class="price-row">
              <span class="price-lbl">Delivery</span>
              <span class="price-val text-green" :class="{ 'text-green': cartStore.deliveryFee === 0 }">
                {{ cartStore.deliveryFee === 0 ? 'Free' : formatPrice(cartStore.deliveryFee) }}
              </span>
            </div>
            <div v-if="cartStore.discountAmount > 0" class="price-row discount">
              <span class="price-lbl">Discount ({{ cartStore.promoDiscount }}%)</span>
              <span class="price-val text-green">- {{ formatPrice(cartStore.discountAmount) }}</span>
            </div>
            <div class="price-row total-row">
              <span class="price-lbl">Total</span>
              <span class="price-val total-highlight-price">{{ formatPrice(cartStore.total) }}</span>
            </div>
          </div>

          <!-- Trust Badges -->
          <div class="summary-trust-badges">
            <div class="sum-trust-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>SSL Secured Payment</span>
            </div>
            <div class="sum-trust-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>100% Authentic Products</span>
            </div>
            <div class="sum-trust-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
              <span>7-Day Return Policy</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- SUCCESS CONFIRMATION OR VERIFYING STATE -->
    <div v-else class="order-confirmation-screen animate-fade-in">
      <!-- Verifying state loader -->
      <div v-if="isVerifying" class="confirmation-card verifying-card">
        <div class="verifying-spinner"></div>
        <h2 class="confirmation-title">Verifying your payment...</h2>
        <p class="confirmation-desc">
          We're checking your transaction status with the payment provider. This should only take a moment. Please do not close or refresh this window.
        </p>
      </div>

      <!-- Verification Error / Polling Timeout state -->
      <div v-else-if="verifyError" class="confirmation-card error-card">
        <div class="error-icon-box">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h2 class="confirmation-title">Verification Pending</h2>
        <p class="confirmation-desc" style="color: #EF4444; font-weight: 600; margin-bottom: 24px; line-height: 1.5;">
          {{ verifyError }}
        </p>
        <div class="confirmation-actions flex-column">
          <button class="btn btn-yellow shop-more-btn w-full" @click="checkStatusManually">
            Check Payment Status Again
          </button>
          <button class="btn btn-outlined track-btn w-full" style="margin-left: 0; margin-top: 10px;" @click="isOrderCompleted = false; verifyError = ''; activeStep = 2; router.push('/checkout')">
            Back to Delivery Details
          </button>
        </div>
      </div>

      <!-- Success order state -->
      <div v-else class="confirmation-card">
        <div class="confirmation-icon-box">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <h2 class="confirmation-title">You've made a <span class="text-yellow font-italic">smart move.</span></h2>
        
        <p class="confirmation-desc">
          Your payment has been successfully settled and confirmed!<br/>
          Your order is now being processed. We'll deliver to you in 1-2 days.
        </p>

        <div class="confirmation-actions">
          <button class="btn btn-outlined track-btn" @click="router.push('/track/' + verifyReference)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Track Your Order
          </button>
          
          <button class="btn btn-yellow shop-more-btn" @click="continueShopping">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkout-view {
  margin-top: 32px;
}

/* Stepper progress */
.checkout-progress-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 40px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 80px;
}

.step-indicator-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border-light);
  color: var(--color-muted-grey);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.step-indicator.active .step-indicator-circle {
  border-color: var(--color-yellow);
  color: var(--color-yellow);
}

.step-indicator.completed .step-indicator-circle {
  background-color: var(--color-yellow);
  border-color: var(--color-yellow);
  color: var(--color-navy);
}

.step-indicator-lbl {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted-grey);
}

.step-indicator.active .step-indicator-lbl, .step-indicator.completed .step-indicator-lbl {
  color: var(--color-slate-headings);
}

.step-indicator-connector {
  flex: 1;
  height: 2px;
  background-color: var(--color-border-light);
  margin-bottom: 22px;
}

.step-indicator-connector.active {
  background-color: var(--color-yellow);
}

/* Main layouts */
.checkout-grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 32px;
}

.checkout-section-box {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 32px;
}

.checkout-section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 24px;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
}

/* Delivery options radio grids */
.delivery-methods-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.delivery-card-icon {
  color: var(--color-purple);
}

.delivery-card-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.delivery-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-slate-headings);
}

.delivery-eta {
  font-size: 12px;
  color: var(--color-muted-grey);
}

.delivery-cost {
  font-size: 13.5px;
  font-weight: 800;
}

/* Promo coupon */
.promo-toggle-btn {
  background: none;
  border: none;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-purple);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
}

.promo-toggle-btn:hover {
  color: var(--color-purple-hover);
}

.promo-input-container {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.promo-text-field {
  max-width: 250px;
}

.promo-apply-btn {
  padding: 10px 20px;
}

.promo-feedback-msg {
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
  color: var(--color-red);
}

/* WhatsApp Payment Alternative */
.whatsapp-alternative-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: 24px;
}

.alternative-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-bottom: 20px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background-color: var(--color-border-light);
}

.divider-text {
  padding: 0 16px;
  font-size: 14px;
  color: var(--color-muted-grey);
  font-weight: 500;
  text-transform: lowercase;
}

.btn-whatsapp-alt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 24px;
  border-radius: 8px;
  border: 1.5px solid #25D366;
  background-color: transparent;
  color: #25D366;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-whatsapp-alt:hover {
  background-color: rgba(37, 211, 102, 0.05);
}

.whatsapp-svg-icon {
  flex-shrink: 0;
}

.whatsapp-alt-subtext {
  font-size: 12px;
  color: var(--color-muted-grey);
  margin-top: 10px;
  text-align: center;
}

.complete-purchase-row {
  display: flex;
  justify-content: flex-end;
}

.complete-btn {
  width: 100%;
  padding: 14px 24px;
}

/* Order Summary Column */
.summary-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 24px;
  position: sticky;
  top: 96px;
}

.summary-card-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
}

.summary-items-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 20px;
  margin-bottom: 20px;
}

.summary-item {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 12px;
  align-items: center;
}

.summary-item-img {
  width: 60px;
  height: 60px;
  object-fit: contain;
  border-radius: 8px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.summary-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-slate-headings);
  line-height: 1.3;
}

.summary-item-price-qty {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-price {
  font-size: 13.5px;
  font-weight: 800;
}

.summary-qty-selector {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  overflow: hidden;
}

.qty-adjust-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-adjust-btn:hover {
  background-color: var(--color-bg);
}

.qty-adjust-count {
  width: 28px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

/* Totals styling */
.summary-pricing-rows {
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
}

.price-row.total-row {
  border-top: 1px dashed var(--color-border-light);
  padding-top: 12px;
  font-weight: 700;
}

.total-highlight-price {
  font-family: var(--font-headings);
  font-size: 24px;
  font-weight: 800;
  color: var(--color-yellow);
}

.summary-trust-badges {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sum-trust-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--color-muted-grey);
}

.sum-trust-badge svg {
  color: var(--color-purple);
  flex-shrink: 0;
}

/* SUCCESS PANEL */
.order-confirmation-screen {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.confirmation-card {
  background-color: var(--color-navy);
  border-radius: 24px;
  color: var(--color-white);
  padding: 60px 48px;
  max-width: 580px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255,255,255,0.05);
}

.confirmation-icon-box {
  width: 64px;
  height: 64px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.confirmation-title {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 16px;
  color: var(--color-white);
}

.font-italic {
  font-style: italic;
}

.confirmation-desc {
  font-size: 16px;
  line-height: 1.6;
  color: #94A3B8;
  margin-bottom: 32px;
}

.confirmation-actions {
  display: flex;
  gap: 16px;
  width: 100%;
  justify-content: center;
}

.track-btn {
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--color-white);
  padding: 12px 24px;
}

.track-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: var(--color-white);
}

.shop-more-btn {
  padding: 12px 24px;
}

.empty-checkout-state {
  text-align: center;
  padding: 60px 24px;
  background-color: var(--color-white);
  border-radius: 16px;
  border: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 480px;
  margin: 40px auto;
}

.empty-checkout-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--color-bg);
  color: var(--color-muted-grey);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 992px) {
  .checkout-grid {
    display: flex;
    flex-direction: column-reverse;
    gap: 32px;
  }
}

@media (max-width: 768px) {
  .delivery-methods-grid {
    grid-template-columns: 1fr;
  }
  .payment-options-grid {
    grid-template-columns: 1fr;
  }
  .confirmation-actions {
    flex-direction: column;
  }
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2.5px solid rgba(0, 0, 0, 0.1);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

.checkout-submit-error {
  color: #e53e3e;
  font-size: 14px;
  font-weight: 500;
  margin-top: 12px;
  text-align: center;
}

.verifying-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-yellow);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.flex-column {
  flex-direction: column;
}

.w-full {
  width: 100% !important;
}

.error-icon-box {
  width: 64px;
  height: 64px;
  background-color: #FEE2E2;
  color: #EF4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}
</style>
