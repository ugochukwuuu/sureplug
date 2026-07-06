<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminProductForm from '../../components/admin/AdminProductForm.vue';
import { mockProducts } from '../../mockProducts';

const route = useRoute();
const router = useRouter();

const product = ref(null);

const loadProduct = async () => {
  const id = Number(route.params.id);
  
  try {
    const res = await fetch(`/api/products/${id}`);
    if (res.ok) {
      product.value = await res.json();
    } else {
      throw new Error();
    }
  } catch (e) {
    // client local fallback
    const found = mockProducts.find(p => p.id === id);
    if (found) {
      product.value = found;
    } else {
      alert('Product not found.');
      router.push('/admin');
    }
  }
};

onMounted(() => {
  loadProduct();
});

const handleCancel = () => {
  router.push('/admin');
};

const handleSubmit = async (payload) => {
  const id = Number(route.params.id);
  const token = localStorage.getItem('sureplug_admin_token');
  
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Product updated successfully in backend.');
      router.push('/admin');
    } else {
      throw new Error();
    }
  } catch (e) {
    console.warn('Backend server not connected yet, processing client-side simulated product update...', e);
    // client-side validation fallback for Batch 1
    const idx = mockProducts.findIndex(p => p.id === id);
    if (idx !== -1) {
      mockProducts[idx] = {
        ...mockProducts[idx],
        ...payload
      };
      alert('Product updated successfully (Client side).');
    }
    router.push('/admin');
  }
};
</script>

<template>
  <div v-if="product" class="admin-edit-view page-wrapper">
    <!-- Back link -->
    <div class="breadcrumb-back-row">
      <router-link to="/admin" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Dashboard
      </router-link>
    </div>

    <div class="form-view-header">
      <h1 class="form-title">Edit Product: <span class="text-purple">#{{ product.id }}</span></h1>
      <p class="form-subtitle">Update pricing, availability status, and recommendation scores.</p>
    </div>

    <AdminProductForm 
      :initialData="product" 
      submitLabel="Update Product" 
      @submit="handleSubmit" 
      @cancel="handleCancel" 
    />
  </div>
</template>

<style scoped>
.admin-edit-view {
  margin-top: 32px;
  margin-bottom: 85px;
}

.breadcrumb-back-row {
  margin-bottom: 20px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-purple);
}

.back-link:hover {
  color: var(--color-purple-hover);
  text-decoration: underline;
}

.form-view-header {
  margin-bottom: 32px;
}

.form-title {
  font-size: 28px;
  font-weight: 800;
}

.form-subtitle {
  font-size: 14.5px;
  color: var(--color-muted-grey);
}

.text-purple {
  color: var(--color-purple);
}
</style>
