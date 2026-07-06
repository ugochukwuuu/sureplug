<script setup>
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <!-- Info Brand Column -->
      <div class="footer-brand-col">
        <div class="footer-logo">
          <img src="../assets/logo.png" alt="Sureplug Logo" class="logo-image" />
          <span class="logo-text">Sureplug</span>
        </div>
        <p class="brand-tagline">The student-first gadget marketplace. Authentic tech. Trusted people. Zero stress.</p>
        <div class="social-links">
          <a href="#" class="social-link" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
          <a href="#" class="social-link" aria-label="Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
          </a>
          <a href="#" class="social-link" aria-label="TikTok">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
          </a>
          <a href="#" class="social-link" aria-label="YouTube">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
          </a>
        </div>
      </div>

      <!-- Links Column 1: Shop -->
      <div class="footer-links-col">
        <h4 class="footer-col-title">Shop</h4>
        <ul class="footer-list">
          <li><router-link to="/marketplace">All Products</router-link></li>
          <li><router-link to="/marketplace?category=laptops">Laptops</router-link></li>
          <li><router-link to="/marketplace?category=phones">Phones</router-link></li>
          <li><router-link to="/marketplace?category=tablets">Tablets</router-link></li>
          <li><router-link to="/marketplace?category=accessories">Accessories</router-link></li>
          <li><router-link to="/marketplace?category=gaming">Gaming</router-link></li>
        </ul>
      </div>

      <!-- Links Column 2: Company -->
      <div class="footer-links-col">
        <h4 class="footer-col-title">Company</h4>
        <ul class="footer-list">
          <li><a href="#">About Us</a></li>
          <li><a href="#">How It Works</a></li>
          <li><a href="#">Careers</a></li>
          <li><a href="#">Press</a></li>
        </ul>
      </div>

      <!-- Links Column 3: Support -->
      <div class="footer-links-col">
        <h4 class="footer-col-title">Support</h4>
        <ul class="footer-list">
          <li><a href="#">Help Center</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Shipping & Delivery</a></li>
          <li><a href="#">Returns & Refunds</a></li>
          <li><a href="#">Terms & Conditions</a></li>
        </ul>
      </div>

      <!-- Column 4: Newsletter -->
      <div class="footer-newsletter-col">
        <h4 class="footer-col-title">Stay in the loop</h4>
        <p class="newsletter-desc">Get updates on new drops, deals and tech tips.</p>
        <form class="newsletter-form" @submit.prevent>
          <input type="email" placeholder="Enter your email" class="newsletter-input" />
          <button type="submit" class="newsletter-btn" aria-label="Subscribe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </form>
      </div>
    </div>

    <!-- Footnotes copyright -->
    <div class="footer-bottom">
      <div class="footer-bottom-content">
        <p class="copyright">© 2025 Sureplug. All rights reserved.</p>
        <div class="footer-bottom-badge">
          <span>Built for students. Backed by trust.</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  background-color: var(--color-navy);
  color: #94A3B8;
  padding: 80px 0 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 14px;
}

.footer-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 48px 60px 48px;
  display: grid;
  grid-template-columns: 2.5fr 1.2fr 1.2fr 1.2fr 2fr;
  gap: 40px;
}

.footer-brand-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 5px;
}

.logo-image {
  height: 38px;
  width: auto;
  object-fit: contain;
  display: block;
}

.logo-text {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--color-white);
  letter-spacing: 0.02em;
}

.brand-tagline {
  line-height: 1.6;
}

.social-links {
  display: flex;
  gap: 12px;
}

.social-link {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94A3B8;
  transition: all 0.2s ease;
}

.social-link:hover {
  background-color: var(--color-yellow);
  color: var(--color-navy);
}

.footer-links-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-col-title {
  color: var(--color-white);
  font-size: 15px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: var(--font-body);
}

.footer-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-list a {
  transition: color 0.2s ease;
}

.footer-list a:hover {
  color: var(--color-yellow);
}

.footer-newsletter-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.newsletter-desc {
  line-height: 1.5;
}

.newsletter-form {
  position: relative;
  width: 100%;
}

.newsletter-input {
  width: 100%;
  padding: 12px 50px 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(255, 255, 255, 0.02);
  color: var(--color-white);
  outline: none;
  transition: all 0.2s ease;
}

.newsletter-input:focus {
  border-color: var(--color-yellow);
  background-color: rgba(255, 255, 255, 0.05);
}

.newsletter-btn {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s ease;
}

.newsletter-btn:hover {
  background-color: var(--color-yellow-hover);
}

.footer-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 30px 0;
  background-color: #070B21;
}

.footer-bottom-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copyright {
  font-size: 13px;
}

.footer-bottom-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-white);
  font-weight: 500;
}

.lock-icon {
  stroke: var(--color-yellow);
}

@media (max-width: 1024px) {
  .footer-content {
    grid-template-columns: 2fr 1.5fr 1.5fr 2fr;
    padding: 0 32px 48px 32px;
  }
  .footer-links-col:nth-child(3) {
    display: none;
  }
}

@media (max-width: 768px) {
  .footer-content {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 0 24px 40px 24px;
  }
  .footer-bottom-content {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
}
</style>
