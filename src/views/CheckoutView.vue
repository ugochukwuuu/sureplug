<script setup>
import { ref, computed } from 'vue';
import { useCartStore } from '../stores/cart';
import { useRouter } from 'vue-router';

const cartStore = useCartStore();
const router = useRouter();

// Step 1: Cart, Step 2: Delivery, Step 3: Payment/Success
const activeStep = ref(2); 
const isPromoOpen = ref(false);
const promoInput = ref('');
const promoMessage = ref('');
const isOrderCompleted = ref(false);

const paymentMethod = ref('card');

// Delivery Form
const form = ref({
  fullName: '',
  phone: '',
  email: '',
  address: '',
  state: '',
  landmark: ''
});

// Card inputs
const cardForm = ref({
  number: '',
  expiry: '',
  cvv: '',
  name: 'Chinedu Adimora'
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

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cartItems: cartStore.cartItems,
        deliveryInfo: form.value,
        paymentMethod: paymentMethod.value,
        deliveryMethod: cartStore.deliveryMethod
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('Order processed successfully on backend database.');
      isOrderCompleted.value = true;
      cartStore.clearCart();
      activeStep.value = 3;
    } else {
      alert(data.error || 'Failed to submit order. Please try again.');
    }
  } catch (e) {
    console.error('Order submission failed:', e);
    alert('Network error. Failed to submit order. Please try again.');
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
      <!-- Step 1 -->
      <div class="step-indicator" :class="{ completed: activeStep > 1, active: activeStep === 1 }">
        <div class="step-indicator-circle">
          <span v-if="activeStep > 1">✓</span>
          <span v-else>1</span>
        </div>
        <span class="step-indicator-lbl">Cart</span>
      </div>
      <div class="step-indicator-connector" :class="{ active: activeStep > 1 }"></div>
      
      <!-- Step 2 -->
      <div class="step-indicator" :class="{ completed: activeStep > 2, active: activeStep === 2 }">
        <div class="step-indicator-circle">
          <span v-if="activeStep > 2">✓</span>
          <span v-else>2</span>
        </div>
        <span class="step-indicator-lbl">Delivery</span>
      </div>
      <div class="step-indicator-connector" :class="{ active: activeStep > 2 }"></div>

      <!-- Step 3 -->
      <div class="step-indicator" :class="{ completed: isOrderCompleted, active: activeStep === 3 }">
        <div class="step-indicator-circle">
          <span>3</span>
        </div>
        <span class="step-indicator-lbl">Payment</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="cartStore.cartItems.length === 0 && !isOrderCompleted" class="empty-checkout-state animate-fade-in">
      <div class="empty-checkout-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
      </div>
      <h2>Your cart is empty</h2>
      <p>Before checking out, select gadgets you would like to purchase from the Marketplace.</p>
      <router-link to="/marketplace" class="btn btn-yellow">Shop Gadgets</router-link>
    </div>

    <!-- MAIN CHECKOUT FLOW -->
    <div v-else-if="!isOrderCompleted" class="checkout-grid">
      <!-- Left Column: Delivery Form & Payment options -->
      <div class="checkout-inputs-panel">
        <!-- Delivery info -->
        <section class="checkout-section-box">
          <h3 class="checkout-section-title">Delivery Information</h3>
          
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input v-model="form.fullName" type="text" placeholder="e.g. Chinedu Adimora" class="form-input" />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input v-model="form.phone" type="text" placeholder="e.g. 0812 345 6789" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input v-model="form.email" type="email" placeholder="e.g. name@student.com" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Delivery Address</label>
            <input v-model="form.address" type="text" placeholder="e.g. Room 402, Jaja Hall" class="form-input" />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">State</label>
              <select v-model="form.state" class="form-select">
                <option>Lagos State</option>
                <option>Ogun State</option>
                <option>Oyo State</option>
                <option>Abuja FCT</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nearest University or Landmark</label>
              <input v-model="form.landmark" type="text" placeholder="e.g. Unilag Front Gate" class="form-input" />
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
        </section>

        <!-- Payment selector -->
        <section class="checkout-section-box payment-section">
          <h3 class="checkout-section-title">How would you like to pay?</h3>
          
          <div class="payment-options-grid">
            <div 
              class="radio-card payment-opt-card" 
              :class="{ selected: paymentMethod === 'card' }"
              @click="paymentMethod = 'card'"
            >
              <div class="radio-circle"><span class="radio-inner-dot"></span></div>
              <div class="payment-card-content">
                <span class="pay-method-title">Pay with Card</span>
                <span class="pay-method-subtitle">Visa, Mastercard</span>
                <div class="pay-card-logos">
                  <span class="card-logo visa">VISA</span>
                  <span class="card-logo master">Mastercard</span>
                </div>
              </div>
            </div>

            <div 
              class="radio-card payment-opt-card" 
              :class="{ selected: paymentMethod === 'transfer' }"
              @click="paymentMethod = 'transfer'"
            >
              <div class="radio-circle"><span class="radio-inner-dot"></span></div>
              <div class="payment-card-content">
                <span class="pay-method-title">Pay with Transfer</span>
                <span class="pay-method-subtitle">All major Nigerian banks</span>
              </div>
            </div>

            <div 
              class="radio-card payment-opt-card" 
              :class="{ selected: paymentMethod === 'delivery' }"
              @click="paymentMethod = 'delivery'"
            >
              <div class="radio-circle"><span class="radio-inner-dot"></span></div>
              <div class="payment-card-content">
                <span class="pay-method-title">Pay on Delivery</span>
                <span class="pay-method-subtitle">Pay cash upon receipt</span>
              </div>
            </div>
          </div>

          <!-- Card inputs -->
          <div v-if="paymentMethod === 'card'" class="card-details-box animate-fade-in">
            <div class="form-group">
              <label class="form-label">Card Number</label>
              <input v-model="cardForm.number" type="text" placeholder="1234 5678 9012 3456" class="form-input" />
            </div>
            
            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">Expiry Date</label>
                <input v-model="cardForm.expiry" type="text" placeholder="MM / YY" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">CVV</label>
                <input v-model="cardForm.cvv" type="password" placeholder="123" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Cardholder Name</label>
              <input v-model="cardForm.name" type="text" placeholder="Chinedu Adimora" class="form-input" />
            </div>
          </div>

          <!-- Buy submit btn -->
          <div class="complete-purchase-row">
            <button class="btn btn-yellow complete-btn" @click="submitOrder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Complete Purchase
            </button>
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

    <!-- SUCCESS CONFIRMATION STATE -->
    <div v-else class="order-confirmation-screen animate-fade-in">
      <div class="confirmation-card">
        <div class="confirmation-icon-box">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <h2 class="confirmation-title">You've made a <span class="text-yellow font-italic">smart move.</span></h2>
        
        <p class="confirmation-desc">
          Your order is confirmed. We'll deliver to you in 1-2 days.<br/>
          Check your email for tracking instructions.
        </p>

        <div class="confirmation-actions">
          <button class="btn btn-outlined track-btn" @click="continueShopping">
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

/* Payment settings */
.payment-section {
  background-color: var(--color-navy);
  color: var(--color-white);
  border-color: rgba(255,255,255,0.05);
}

.payment-section .checkout-section-title {
  color: var(--color-white);
}

.payment-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.payment-opt-card {
  align-items: flex-start;
  color: var(--color-slate-body);
}

.payment-opt-card.selected {
  background-color: var(--color-white);
}

.pay-method-title {
  font-size: 13px;
  font-weight: 700;
  display: block;
}

.pay-method-subtitle {
  font-size: 11px;
  color: var(--color-muted-grey);
}

.pay-card-logos {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.card-logo {
  font-size: 8px;
  font-weight: 700;
  padding: 2px 4px;
  border-radius: 4px;
  color: var(--color-white);
}

.card-logo.visa { background-color: #1A1F71; }
.card-logo.master { background-color: #EB001B; }

.card-details-box {
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.card-details-box .form-label {
  color: var(--color-white);
}

.card-details-box .form-input {
  background-color: rgba(10,15,41,0.5);
  border-color: rgba(255,255,255,0.1);
  color: var(--color-white);
}

.card-details-box .form-input:focus {
  border-color: var(--color-yellow);
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
    grid-template-columns: 1fr;
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
</style>
