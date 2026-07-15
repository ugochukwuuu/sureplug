<script setup>
import { useRouter } from 'vue-router';
import { brandConfig as brand } from '@/services/brandService.js';

const router = useRouter();
</script>

<template>
  <div class="not-found-container page-wrapper">
    <div class="not-found-content animate-fade-in">
      <h1 class="not-found-title">404</h1>
      <h2 class="not-found-subtitle">Hmm, this page doesn't exist.</h2>
      <p class="not-found-text">It might have moved or never existed in the first place.</p>
      
      <div class="not-found-actions">
        <button @click="router.push('/')" class="btn btn-yellow">
          Go Home
        </button>
        <button @click="router.push('/marketplace')" class="btn btn-outlined-white">
          Browse Marketplace
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  background-color: var(--color-secondary, #1E0E62);
  min-height: calc(100vh - 120px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 24px;
}

.not-found-content {
  text-align: center;
  max-width: 600px;
  width: 100%;
}

.not-found-title {
  font-family: var(--font-display, 'Shrikhand'), serif;
  font-size: 8rem;
  color: var(--color-primary, #FFB800);
  line-height: 1;
  margin-bottom: 24px;
  text-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.not-found-subtitle {
  font-family: var(--font-body, 'Plus Jakarta Sans'), sans-serif;
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-surface, #FFFFFF);
  margin-bottom: 12px;
}

.not-found-text {
  font-family: var(--font-body, 'Plus Jakarta Sans'), sans-serif;
  font-size: 1.1rem;
  color: var(--color-accent, #C4B5FD);
  margin-bottom: 40px;
  opacity: 0.9;
}

.not-found-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.btn-outlined-white {
  background-color: transparent;
  color: var(--color-surface, #FFFFFF);
  border: 2px solid rgba(255, 255, 255, 0.4);
  font-size: 15px;
  padding: 12px 24px;
  border-radius: var(--radius-button, 8px);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-outlined-white:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: var(--color-surface, #FFFFFF);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .not-found-title {
    font-size: 6rem;
  }
  .not-found-subtitle {
    font-size: 1.5rem;
  }
  .not-found-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
