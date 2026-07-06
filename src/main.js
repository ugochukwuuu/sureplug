import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

// Global Fetch Interceptor to handle JWT 401 Expiry
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  try {
    const response = await originalFetch(...args);
    if (response.status === 401) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
      if (url.includes('/api/')) {
        localStorage.removeItem('sureplug_admin_token');
        localStorage.removeItem('sureplug_admin_authenticated');
        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/admin/login?reason=session_expired';
        }
      }
    }
    return response;
  } catch (err) {
    throw err;
  }
};

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
