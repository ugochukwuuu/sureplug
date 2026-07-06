<template>
  <div class="sell-device-container">
    <div class="sell-device-content">
      <!-- Title -->
      <h1 class="headline">Turn your device into cash.</h1>
      
      <!-- Description -->
      <p class="description">
        Got a laptop, phone or gadget you're no longer using? We'll buy it from you. Just send us a message on WhatsApp and let's talk.
      </p>

      <!-- WhatsApp CTA Button -->
      <a 
        href="https://wa.me/2348012345678?text=Hi%20Sureplug%2C%20I%20have%20a%20device%20I%20want%20to%20sell." 
        target="_blank" 
        rel="noopener noreferrer" 
        class="whatsapp-cta"
      >
        <!-- WhatsApp SVG Icon -->
        <svg class="whatsapp-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 1.98 14.117.953 11.487.953c-5.412 0-9.819 4.364-9.824 9.795-.002 1.8.487 3.562 1.418 5.12L2.094 21.8l6.082-1.586c-1.513.918-1.513.918-.04 1.564zM17.65 14.6c-.3-.15-1.774-.874-2.048-.974-.274-.1-.474-.15-.674.15-.2.3-.774.974-.948 1.174-.174.2-.35.225-.65.075-.3-.15-1.263-.465-2.407-1.485-.89-.795-1.49-1.777-1.664-2.077-.174-.3-.018-.463.13-.61.134-.133.3-.349.45-.524.15-.175.2-.3.3-.5s.05-.375-.025-.525C9.9 8.8 9.3 7.348 9.05 6.748c-.244-.588-.492-.507-.674-.516-.174-.008-.374-.01-.574-.01-.2 0-.525.075-.8.375-.274.3-1.048 1.024-1.048 2.5s1.074 2.9 1.224 3.1c.15.2 2.11 3.22 5.116 4.52 1.63.708 2.22.775 3.018.66.788-.115 1.774-.725 2.024-1.399.25-.675.25-1.25.174-1.399-.074-.15-.274-.225-.574-.375z"/>
        </svg>
        Chat us on WhatsApp
      </a>

      <!-- Trust Points Header / Icons Row -->
      <div class="trust-points-row">
        <!-- Trust Point 1 -->
        <div class="trust-item">
          <div class="icon-box">
            <!-- Money / Cash SVG Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2"></rect>
              <circle cx="12" cy="12" r="2"></circle>
              <path d="M6 12h.01M18 12h.01"></path>
            </svg>
          </div>
          <span class="trust-text">We pay fairly</span>
        </div>

        <!-- Trust Point 2 -->
        <div class="trust-item">
          <div class="icon-box">
            <!-- Lightning Bolt SVG Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <span class="trust-text">Quick response</span>
        </div>

        <!-- Trust Point 3 -->
        <div class="trust-item">
          <div class="icon-box">
            <!-- Smile / Check Shield SVG Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 11 11 13 15 9"></polyline>
            </svg>
          </div>
          <span class="trust-text">Zero stress</span>
        </div>
      </div>

      <!-- Reassurance Subtext -->
      <p class="reassurance-text">We typically respond within a few hours.</p>
    </div>
  </div>
</template>

<style scoped>
.sell-device-container {
  min-height: calc(100vh - 72px); /* offset navbar height */
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-white);
  padding: 80px 24px;
  width: 100%;
}

.sell-device-content {
  text-align: center;
  max-width: 580px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.headline {
  font-family: 'Shrikhand', cursive;
  font-size: 44px;
  font-weight: normal;
  color: var(--color-navy);
  margin-bottom: 20px;
  line-height: 1.15;
}

.description {
  font-family: 'Plus Jakarta Sans', var(--font-body);
  font-size: 17px;
  line-height: 1.65;
  color: var(--color-muted-grey);
  margin-bottom: 36px;
  font-weight: 500;
}

.whatsapp-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  font-family: 'Plus Jakarta Sans', var(--font-body);
  font-size: 16px;
  font-weight: 800;
  padding: 18px 36px;
  border-radius: 14px;
  text-decoration: none;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(229, 173, 0, 0.25);
  margin-bottom: 48px;
}

.whatsapp-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(229, 173, 0, 0.35);
  background-color: #F5C300; /* slightly darker yellow on hover */
}

.whatsapp-cta:active {
  transform: translateY(0);
}

.whatsapp-icon {
  flex-shrink: 0;
}

.trust-points-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  margin-bottom: 32px;
  width: 100%;
  border-top: 1px solid var(--color-border-light);
  padding-top: 36px;
}

.trust-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.icon-box {
  background-color: var(--color-bg);
  color: var(--color-purple);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  transition: transform 0.2s ease;
}

.trust-item:hover .icon-box {
  transform: scale(1.08);
}

.trust-text {
  font-family: 'Plus Jakarta Sans', var(--font-body);
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-navy);
  white-space: nowrap;
}

.reassurance-text {
  font-family: 'Plus Jakarta Sans', var(--font-body);
  font-size: 13px;
  color: var(--color-muted-grey);
  font-weight: 500;
  margin: 0;
}

@media (max-width: 576px) {
  .headline {
    font-size: 34px;
  }
  .description {
    font-size: 15px;
  }
  .trust-points-row {
    gap: 20px;
    padding-top: 28px;
  }
  .trust-text {
    font-size: 12px;
  }
  .whatsapp-cta {
    padding: 16px 28px;
    font-size: 15px;
    width: 100%;
  }
}
</style>
