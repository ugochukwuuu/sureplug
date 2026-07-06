<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const errorMessage = ref('');
const isLoading = ref(false);
const isSessionExpired = ref(false);

onMounted(() => {
  if (route.query.reason === 'session_expired') {
    isSessionExpired.value = true;
  }
});

const handleLogin = async () => {
  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = 'Please enter both your admin email and password.';
    return;
  }
  
  errorMessage.value = '';
  isLoading.value = true;
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value
      })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('sureplug_admin_token', data.token);
      localStorage.setItem('sureplug_admin_authenticated', 'true');
      router.push('/admin');
    } else {
      errorMessage.value = 'Invalid email or password.';
    }
  } catch (err) {
    console.error('Login request failed:', err);
    errorMessage.value = 'Failed to connect to the server. Please try again.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="admin-login-view">
    <div class="login-card">
      <div class="login-header">
        <img src="../../assets/logo.png" alt="Sureplug Logo" class="login-logo" />
        <h1 class="login-title">Admin Access</h1>
        <p class="login-subtitle">Enter credentials to access the merchant console.</p>
      </div>

      <!-- Session Expired Notice Banner -->
      <div v-if="isSessionExpired" class="session-expired-banner animate-fade-in">
        Your session has expired. Please log in again.
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email" class="form-label">Email Address</label>
          <input 
            v-model="email" 
            type="email" 
            id="email" 
            class="form-input" 
            placeholder="admin@sureplug.com" 
            required 
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <div class="password-input-wrapper">
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              id="password" 
              class="form-input password-input" 
              placeholder="••••••••" 
              required 
            />
            <button 
              type="button" 
              class="password-toggle-btn" 
              @click="showPassword = !showPassword"
              aria-label="Toggle password visibility"
            >
              <svg v-if="showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-navy login-btn" :disabled="isLoading">
          <span v-if="isLoading">Authenticating...</span>
          <span v-else>Login to Dashboard</span>
        </button>

        <!-- Redirect to register link -->
        <div class="redirect-row">
          <span>Don't have an admin account? </span>
          <router-link to="/admin/register" class="redirect-link">Register here</router-link>
        </div>

        <div v-if="errorMessage" class="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{{ errorMessage }}</span>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.session-expired-banner {
  background-color: #FEF3C7;
  border: 1px solid #F59E0B;
  color: #B45309;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
}

.admin-login-view {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
  padding: 40px 24px;
}

.login-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 20px;
  width: 100%;
  max-width: 440px;
  padding: 40px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  height: 44px;
  width: auto;
  object-fit: contain;
  margin-bottom: 16px;
}

.login-title {
  font-family: var(--font-headings);
  font-size: 24px;
  font-weight: 800;
  color: var(--color-navy);
  margin-bottom: 6px;
}

.login-subtitle {
  font-size: 13.5px;
  color: var(--color-muted-grey);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-banner {
  background-color: #FEE2E2;
  color: var(--color-red);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-slate-headings);
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  outline: none;
  font-size: 14px;
  transition: all 0.2s ease;
  background-color: #FAFAFB;
}

.form-input:focus {
  background-color: var(--color-white);
  border-color: var(--color-navy);
  box-shadow: 0 0 0 3px rgba(30, 14, 98, 0.08);
}

.login-btn {
  width: 100%;
  padding: 14px;
  font-size: 14px;
  margin-top: 10px;
}

.password-input-wrapper {
  position: relative;
  width: 100%;
}

.password-input {
  padding-right: 48px;
}

.password-toggle-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted-grey);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
  padding: 4px;
}

.password-toggle-btn:hover {
  color: var(--color-navy);
}

.redirect-row {
  display: flex;
  justify-content: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-slate-body);
  margin-top: 4px;
}

.redirect-link {
  color: var(--color-purple);
  font-weight: 600;
}

.redirect-link:hover {
  color: var(--color-purple-hover);
  text-decoration: underline;
}
</style>
