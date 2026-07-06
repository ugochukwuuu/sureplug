<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);

const handleRegister = async () => {
  if (!email.value.trim() || !password.value.trim() || !confirmPassword.value.trim()) {
    errorMessage.value = 'All fields are required.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }

  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;

  try {
    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value
      })
    });

    const data = await res.json();

    if (res.ok) {
      successMessage.value = 'Admin account registered successfully! Redirecting to login...';
      setTimeout(() => {
        router.push('/admin/login');
      }, 2000);
    } else {
      errorMessage.value = data.error || 'Failed to register admin account.';
    }
  } catch (err) {
    console.error('Registration failed:', err);
    errorMessage.value = 'Failed to connect to the server. Please try again.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="admin-register-view">
    <div class="register-card">
      <div class="register-header">
        <img src="../../assets/logo.png" alt="Sureplug Logo" class="register-logo" />
        <h1 class="register-title">Register Admin</h1>
        <p class="register-subtitle">Create a merchant console administrator account.</p>
      </div>

      <form class="register-form" @submit.prevent="handleRegister">
        <!-- Email Input -->
        <div class="form-group">
          <label for="email" class="form-label">Email Address</label>
          <input 
            v-model="email" 
            type="email" 
            id="email" 
            class="form-input" 
            placeholder="e.g. ugobright31@gmail.com" 
            required 
          />
        </div>

        <!-- Password Input -->
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

        <!-- Confirm Password Input -->
        <div class="form-group">
          <label for="confirmPassword" class="form-label">Confirm Password</label>
          <input 
            v-model="confirmPassword" 
            :type="showPassword ? 'text' : 'password'" 
            id="confirmPassword" 
            class="form-input" 
            placeholder="••••••••" 
            required 
          />
        </div>

        <!-- Register button -->
        <button type="submit" class="btn btn-navy register-btn" :disabled="isLoading">
          <span v-if="isLoading">Registering Account...</span>
          <span v-else>Create Account</span>
        </button>

        <!-- Redirect to login link -->
        <div class="redirect-row">
          <span>Already have an admin account? </span>
          <router-link to="/admin/login" class="redirect-link">Login here</router-link>
        </div>

        <!-- Error banner -->
        <div v-if="errorMessage" class="banner error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Success banner -->
        <div v-if="successMessage" class="banner success-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>{{ successMessage }}</span>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.admin-register-view {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
  padding: 40px 24px;
}

.register-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 20px;
  width: 100%;
  max-width: 440px;
  padding: 40px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
}

.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-logo {
  height: 44px;
  width: auto;
  object-fit: contain;
  margin-bottom: 16px;
}

.register-title {
  font-family: var(--font-headings);
  font-size: 24px;
  font-weight: 800;
  color: var(--color-navy);
  margin-bottom: 6px;
}

.register-subtitle {
  font-size: 13.5px;
  color: var(--color-muted-grey);
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.banner {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.error-banner {
  background-color: #FEE2E2;
  color: var(--color-red);
}

.success-banner {
  background-color: var(--color-green-bg);
  color: var(--color-green);
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

.register-btn {
  width: 100%;
  padding: 14px;
  font-size: 14px;
  margin-top: 10px;
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
