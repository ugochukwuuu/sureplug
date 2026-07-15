<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { brandConfig as brand } from '@/services/brandService.js';

const route = useRoute();
const router = useRouter();

// Extracts query parameters
const refParam = route.query.ref || '';
const productParam = route.query.product || '';
const productId = parseInt(productParam, 10);

// Page states
const isValidating = ref(true);
const validationError = ref('');
const isSubmitting = ref(false);
const submitError = ref('');
const isSubmitted = ref(false);

// Form model
const reviewerName = ref('');
const rating = ref(0);
const hoverRating = ref(0);
const comment = ref('');

// Product details (resolved after validation)
const productTitle = ref('');

// Preflight validation on mount
onMounted(async () => {
  if (!refParam || isNaN(productId)) {
    validationError.value = 'Invalid review link. Order reference and product ID are required.';
    isValidating.value = false;
    return;
  }

  try {
    // 1. Preflight validation check
    const validateRes = await fetch(`/api/reviews/validate?ref=${encodeURIComponent(refParam)}&product=${productId}`);
    const validateData = await validateRes.json();

    if (!validateRes.ok || !validateData.valid) {
      validationError.value = validateData.error || 'Failed to validate your purchase link.';
      isValidating.value = false;
      return;
    }

    reviewerName.value = validateData.customerName || '';

    // 2. Fetch product info to show on the form
    const productRes = await fetch(`/api/products/${productId}`);
    if (productRes.ok) {
      const prod = await productRes.json();
      productTitle.value = prod.title;
    } else {
      productTitle.value = 'Verified Product';
    }

    isValidating.value = false;
  } catch (err) {
    console.error('Validation fetch error:', err);
    validationError.value = 'A network error occurred while validating your review link.';
    isValidating.value = false;
  }
});

// Interactive star selection handlers
const setRating = (r) => {
  rating.value = r;
};

const hoverStar = (r) => {
  hoverRating.value = r;
};

const leaveStar = () => {
  hoverRating.value = 0;
};

// Form submission handler
const submitReview = async () => {
  if (rating.value === 0) {
    submitError.value = 'Please select a star rating between 1 and 5.';
    return;
  }

  if (comment.value.trim().length < 10) {
    submitError.value = 'Your review comment must be at least 10 characters long.';
    return;
  }

  isSubmitting.value = true;
  submitError.value = '';

  try {
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_reference: refParam,
        rating: rating.value,
        comment: comment.value
      })
    });

    const data = await res.json();

    if (res.ok) {
      isSubmitted.value = true;
    } else {
      submitError.value = data.error || 'Failed to submit review.';
    }
  } catch (err) {
    console.error('Submit review failure:', err);
    submitError.value = 'A network error occurred. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="review-view-container page-wrapper">
    <!-- Validation Loading Overlay -->
    <div v-if="isValidating" class="validation-card loading-card animate-fade-in">
      <div class="spinner"></div>
      <h3>Verifying Purchase Reference...</h3>
      <p>Please wait while we confirm your transaction data.</p>
    </div>

    <!-- Validation Error Panel -->
    <div v-else-if="validationError" class="validation-card error-card animate-fade-in">
      <div class="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <h2 class="error-title">Verification Failed</h2>
      <p class="error-desc">{{ validationError }}</p>
      <button class="btn btn-navy" @click="router.push('/marketplace')">Return to Marketplace</button>
    </div>

    <!-- Success Screen (Thank You Page) -->
    <div v-else-if="isSubmitted" class="validation-card success-card animate-fade-in">
      <div class="checkmark-circle">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h1 class="success-heading">Thanks for your review!</h1>
      <p class="success-subtext">Your review helps other students make smarter choices.</p>
      <button class="btn btn-navy back-marketplace-btn" @click="router.push('/marketplace')">
        Continue Shopping
      </button>
    </div>

    <!-- Submission Form Container -->
    <div v-else class="review-form-card animate-fade-in">
      <div class="form-header">
        <h2 class="form-title">Submit a Review</h2>
        <p class="form-subtitle">Rate your purchase of <strong>{{ productTitle }}</strong></p>
      </div>

      <form @submit.prevent="submitReview" class="review-input-form">
        <!-- Error Alert -->
        <div v-if="submitError" class="submit-error-alert animate-fade-in">
          {{ submitError }}
        </div>

        <!-- Reviewer Name -->
        <div class="form-group">
          <label class="form-label" for="reviewer-name">Your Name <span class="required-star">*</span></label>
          <input 
            v-model="reviewerName" 
            type="text" 
            id="reviewer-name" 
            class="form-input readonly-input" 
            readonly
            required 
          />
        </div>

        <!-- Star Rating Selector -->
        <div class="form-group">
          <label class="form-label">Star Rating <span class="required-star">*</span></label>
          <div class="star-rating-selector" @mouseleave="leaveStar">
            <button 
              v-for="index in 5" 
              :key="index" 
              type="button" 
              class="star-btn"
              @mouseover="hoverStar(index)"
              @click="setRating(index)"
            >
              <svg 
                width="36" 
                height="36" 
                viewBox="0 0 24 24" 
                :fill="index <= (hoverRating || rating) ? 'var(--color-primary)' : 'none'" 
                :stroke="index <= (hoverRating || rating) ? 'var(--color-primary)' : '#CBD5E1'" 
                stroke-width="2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
            <span class="rating-text-label" v-if="rating > 0">
              {{ rating }} out of 5
            </span>
          </div>
        </div>

        <!-- Review Comment Textarea -->
        <div class="form-group">
          <div class="label-row-split">
            <label class="form-label" for="review-comment">Your Review <span class="required-star">*</span></label>
            <span class="char-count" :class="{ 'char-count-ok': comment.length >= 10 }">
              {{ comment.length }} / Min 10 chars
            </span>
          </div>
          <textarea 
            v-model="comment" 
            id="review-comment" 
            rows="5" 
            placeholder="Tell us about the device performance, battery life, screen quality, etc..." 
            class="form-textarea" 
            required
          ></textarea>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          class="btn submit-action-btn" 
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting" class="spinner-btn"></span>
          <span v-else>Submit Review</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.review-view-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
  padding: 40px 20px;
  margin-top: 20px;
}

.validation-card {
  background-color: var(--color-white);
  border-radius: 24px;
  border: 1px solid var(--color-border-light);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  padding: 48px 32px;
  width: 100%;
  max-width: 550px;
  text-align: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--color-border-light);
  border-top-color: var(--color-navy);
  border-radius: 50%;
  margin: 0 auto 24px auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-navy);
  margin-bottom: 12px;
}

.error-desc {
  font-size: 15px;
  color: var(--color-muted-grey);
  line-height: 1.6;
  margin-bottom: 32px;
}

/* Success Card */
.checkmark-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background-color: #FFFBEB;
  border: 3px solid #FDE68A;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px auto;
}

.success-heading {
  font-family: var(--font-display);
  font-size: 32px;
  color: var(--color-navy);
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.success-subtext {
  font-size: 16px;
  color: var(--color-muted-grey);
  margin-bottom: 32px;
}

.back-marketplace-btn {
  background-color: var(--color-navy) !important;
  color: var(--color-white) !important;
  padding: 14px 32px;
  font-size: 15px;
}

/* Form Card */
.review-form-card {
  background-color: var(--color-white);
  border-radius: 24px;
  border: 1px solid var(--color-border-light);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
  padding: 40px;
  width: 100%;
  max-width: 600px;
}

.form-header {
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 20px;
  margin-bottom: 24px;
}

.form-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-navy);
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 14.5px;
  color: var(--color-muted-grey);
}

.required-star {
  color: #EF4444;
}

.optional-tag {
  font-size: 12px;
  font-weight: normal;
  color: var(--color-muted-grey);
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-slate-headings);
  margin-bottom: 8px;
}

.form-input, .form-textarea {
  width: 100%;
  border: 1.5px solid var(--color-border-light);
  border-radius: 8px;
  padding: 12px;
  font-size: 14.5px;
  transition: all 0.2s ease;
  background-color: var(--color-bg);
}

.form-input.readonly-input {
  background-color: #E2E8F0;
  color: #475569;
  cursor: not-allowed;
  border-color: var(--color-border-light);
}

.form-input.readonly-input:focus {
  border-color: var(--color-border-light);
  box-shadow: none;
  background-color: #E2E8F0;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--color-navy);
  background-color: var(--color-white);
  box-shadow: 0 0 0 3px rgba(30, 14, 98, 0.05);
}

/* Stars Rating Selector */
.star-rating-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.star-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.star-btn:hover {
  transform: scale(1.15);
}

.rating-text-label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-muted-grey);
  margin-left: 12px;
}

/* Comment Box Label */
.label-row-split {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-count {
  font-size: 12px;
  color: #EF4444;
}

.char-count-ok {
  color: #10B981;
}

/* Submit Action Button */
.submit-action-btn {
  background-color: var(--color-secondary) !important; /* Deep Indigo */
  color: var(--color-white) !important;
  width: 100%;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  border-radius: 8px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-action-btn:hover {
  background-color: #150A47 !important;
}

.submit-error-alert {
  background-color: #FEF2F2;
  border: 1px solid #FCA5A5;
  color: #991B1B;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13.5px;
  margin-bottom: 20px;
}

.spinner-btn {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
