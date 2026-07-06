<script setup>
import { computed } from 'vue';

const props = defineProps({
  product: {
    type: Object,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: true
  },
  matchPercentage: {
    type: Number,
    default: 85
  },
  bullets: {
    type: Array,
    default: () => []
  },
  handler: {
    type: String,
    default: ''
  }
});

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

const contextText = computed(() => {
  const useCases = props.product?.useCases || [];
  const list = Array.isArray(useCases) ? useCases : JSON.parse(useCases || '[]');
  if (list.length === 0) return 'General Academic Use';
  return list.join(' · ');
});
</script>

<template>
  <div class="ai-verdict-card" :class="{ 'is-loading': isLoading }">
    <!-- Skeleton Loading State -->
    <div v-if="isLoading" class="verdict-grid skeleton-grid">
      <div class="verdict-content">
        <div class="verdict-icon-container">
          <div class="skeleton-sparkle-placeholder"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
        <div class="skeleton-list">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
      </div>
      <div class="verdict-gauge-container skeleton-gauge-container">
        <div class="skeleton skeleton-circle"></div>
        <div class="skeleton skeleton-context"></div>
      </div>
    </div>

    <!-- Loaded State -->
    <div v-else class="verdict-grid loaded-grid animate-fade-in">
      <!-- Left: Sparkles & Bullets -->
      <div class="verdict-content">
        <div class="verdict-icon-container">
          <div class="verdict-sparkle-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path>
            </svg>
          </div>
          <h3 class="verdict-title">What our AI thinks about this for you</h3>
        </div>

        <ul class="verdict-list">
          <li v-for="(bullet, index) in bullets" :key="index" class="verdict-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{{ bullet }}</span>
          </li>
        </ul>

        <!-- Understated Engine Handler Info -->
        <div v-if="handler" class="verdict-handler-text">
          Powered by {{ handler === 'gemini' ? 'Gemini AI' : 'local engine' }}
        </div>
      </div>

      <!-- Right: Match circular meter -->
      <div class="verdict-gauge-container">
        <div class="gauge-circle">
          <svg class="progress-ring" width="120" height="120">
            <!-- Background circle -->
            <circle class="progress-ring-bg" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="transparent" r="50" cx="60" cy="60" />
            <!-- Active circle -->
            <circle 
              class="progress-ring-active" 
              stroke="var(--color-yellow)" 
              stroke-width="8" 
              stroke-linecap="round"
              fill="transparent" 
              r="50" 
              cx="60" 
              cy="60" 
              :stroke-dasharray="314"
              :stroke-dashoffset="314 - (314 * matchPercentage) / 100"
            />
          </svg>
          <div class="gauge-text">
            <span class="gauge-number">{{ matchPercentage }}%</span>
            <span class="gauge-label">Match</span>
          </div>
        </div>
        <p class="gauge-context">
          Based on:<br/>
          <span>{{ contextText }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-verdict-card {
  background-color: var(--color-lavender);
  border-radius: 16px;
  padding: 32px;
  margin-top: 40px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  min-height: 250px;
  transition: all 0.3s ease;
}

.verdict-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  align-items: center;
  gap: 32px;
}

.verdict-icon-container {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.verdict-sparkle-icon {
  width: 44px;
  height: 44px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.verdict-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-navy);
  font-family: var(--font-headings);
}

.verdict-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.verdict-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-navy);
}

.check-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.verdict-handler-text {
  font-size: 11.5px;
  color: var(--color-navy);
  opacity: 0.5;
  margin-top: 20px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Match Gauge Styling */
.verdict-gauge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background-color: var(--color-navy);
  border-radius: 16px;
  padding: 24px;
  color: var(--color-white);
  box-shadow: 0 10px 20px rgba(10, 15, 41, 0.1);
  min-height: 200px;
  justify-content: center;
}

.gauge-circle {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-active {
  transition: stroke-dashoffset 0.8s ease-out;
  transform-origin: 50% 50%;
}

.gauge-text {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gauge-number {
  font-family: var(--font-headings);
  font-size: 26px;
  font-weight: 800;
  color: var(--color-white);
  line-height: 1;
}

.gauge-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-yellow);
  letter-spacing: 0.05em;
  margin-top: 2px;
}

.gauge-context {
  font-size: 12px;
  color: var(--color-muted-grey);
  line-height: 1.4;
  margin-top: 8px;
}

.gauge-context span {
  color: var(--color-white);
  font-weight: 600;
}

/* Skeleton Loading Styling */
.skeleton {
  background: linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%);
  background-size: 200% 100%;
  animation: loading-pulse 1.5s infinite;
  border-radius: 6px;
}

@keyframes loading-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-sparkle-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%);
  background-size: 200% 100%;
  animation: loading-pulse 1.5s infinite;
}

.skeleton-title {
  height: 24px;
  width: 280px;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-text {
  height: 16px;
  width: 90%;
}

.skeleton-text:nth-child(2) {
  width: 75%;
}

.skeleton-text:nth-child(3) {
  width: 85%;
}

.skeleton-circle {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  margin-bottom: 16px;
}

.skeleton-context {
  height: 14px;
  width: 140px;
}

/* Animations */
.animate-fade-in {
  animation: fadeIn 0.4s ease forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .verdict-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .verdict-gauge-container {
    max-width: 320px;
    margin: 0 auto;
    width: 100%;
  }
}
</style>
