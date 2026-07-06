<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import SpecFieldEditor from './SpecFieldEditor.vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: null
  },
  submitLabel: {
    type: String,
    default: 'Save Product'
  }
});

const emit = defineEmits(['submit', 'cancel']);

// Form states
const form = reactive({
  title: '',
  brand: '',
  category: 'Laptops',
  price: 0,
  description: '',
  specifications: '{}',
  is_available: true,
  useCases: [],
  strengths: [],
  ratings: {}
});

// Category fetch states
const categoriesList = ref([
  'Laptops', 'Phones', 'Tablets', 'Accessories', 'Gaming', 'Audio',
  'Keyboards', 'Mice', 'Monitors', 'Projectors', 'Batteries & Power Banks',
  'Storage Devices', 'Networking', 'Wearables', 'Cameras'
]);

const loadCategories = async () => {
  try {
    const res = await fetch('/api/categories');
    if (res.ok) {
      categoriesList.value = await res.json();
    }
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
};

// Brand combobox fetch states
const existingBrands = ref([]);
const loadBrands = async () => {
  try {
    const res = await fetch('/api/brands');
    if (res.ok) {
      existingBrands.value = await res.json();
    }
  } catch (e) {
    console.error('Failed to load brands:', e);
  }
};

// Configuration rules per category
const categoryMetadataRules = {
  'Laptops': {
    useCases: ['Programming', 'Graphic Design', 'Gaming', 'Business', 'Engineering', 'Content Creation'],
    strengths: ['Excellent Battery', 'Portable', 'High Performance', 'Premium Display', 'Upgradeable', 'Quiet', 'Durable'],
    ratings: ['Gaming', 'Programming', 'Battery', 'Video Editing', 'Portability', 'Performance', 'Value for Money']
  },
  'Phones': {
    useCases: ['Social Media', 'Photography', 'Gaming', 'Business', 'Study'],
    strengths: ['Excellent Battery', 'Portable', 'Fast Charging', 'Premium Camera', 'Compact', 'Durable'],
    ratings: ['Battery', 'Portability', 'Performance', 'Value for Money', 'Camera Quality']
  },
  'Tablets': {
    useCases: ['Graphic Design', 'Study', 'Business', 'Entertainment', 'Content Creation'],
    strengths: ['Excellent Battery', 'Portable', 'Premium Display', 'Stylus Support', 'Lightweight'],
    ratings: ['Battery', 'Portability', 'Performance', 'Value for Money', 'Display Quality', 'Stylus Precision']
  },
  'Audio': {
    useCases: ['Entertainment', 'Gaming', 'Sport', 'Business'],
    strengths: ['Noise Cancelling', 'Long Battery Life', 'Comfortable', 'Deep Bass', 'Water Resistant'],
    ratings: ['Audio Quality', 'Comfort', 'Battery Life', 'Noise Isolation', 'Value for Money']
  },
  'Keyboards': {
    useCases: ['Programming', 'Gaming', 'Office Work'],
    strengths: ['Mechanical Switches', 'RGB Backlight', 'Wireless', 'Ergonomic', 'Hot-swappable'],
    ratings: ['Typing Feel', 'Build Quality', 'Battery Life', 'Value for Money']
  },
  'Mice': {
    useCases: ['Gaming', 'Graphic Design', 'Office Work'],
    strengths: ['Ergonomic', 'High Precision DPI', 'Wireless', 'Ultra Lightweight', 'Silent Click'],
    ratings: ['Precision', 'Ergonomics', 'Battery Life', 'Value for Money']
  },
  'Monitors': {
    useCases: ['Gaming', 'Graphic Design', 'Programming', 'Entertainment', 'Business'],
    strengths: ['High Refresh Rate', '4K Resolution', 'IPS Panel', 'Curved Display', 'Color Accurate'],
    ratings: ['Display Quality', 'Color Accuracy', 'Gaming Performance', 'Value for Money']
  },
  'Projectors': {
    useCases: ['Entertainment', 'Business', 'Education'],
    strengths: ['High Brightness', '4K Support', 'Portable', 'Built-in Speakers', 'Short Throw'],
    ratings: ['Brightness', 'Image Sharpness', 'Portability', 'Value for Money']
  },
  'Batteries & Power Banks': {
    useCases: ['Travel', 'Emergency Power', 'Daily Use'],
    strengths: ['High Capacity', 'Fast Charging', 'Multiple Ports', 'Compact', 'Safe Overcharge Protection'],
    ratings: ['Power Capacity', 'Charging Speed', 'Portability', 'Value for Money']
  },
  'Storage Devices': {
    useCases: ['Backups', 'High Speed Gaming', 'File Transfer'],
    strengths: ['NVMe High Speed', 'Rugged/Shockproof', 'Compact', 'Large Capacity'],
    ratings: ['Read/Write Speed', 'Durability', 'Value for Money']
  },
  'Networking': {
    useCases: ['Home Wi-Fi', 'Gaming', 'Office Network'],
    strengths: ['Wi-Fi 6 Support', 'Dual-Band', 'High Range Coverage', 'Easy Setup'],
    ratings: ['Signal Strength', 'Speed Performance', 'Value for Money']
  },
  'Wearables': {
    useCases: ['Sport & Fitness', 'Daily Assistant', 'Health Monitoring'],
    strengths: ['Heart Rate Monitor', 'GPS Tracking', 'Waterproof', 'AMOLED Screen', 'Long Battery'],
    ratings: ['Sensors Accuracy', 'Battery Life', 'Comfort', 'Value for Money']
  },
  'Cameras': {
    useCases: ['Photography', 'Vlogging', 'Content Creation', 'Travel'],
    strengths: ['4K Video', 'Optical Zoom', 'Image Stabilization', 'Compact', 'Interchangeable Lenses'],
    ratings: ['Image Quality', 'Video Capability', 'Focus Speed', 'Value for Money']
  }
};

const defaultMetadataRule = {
  useCases: ['General Use', 'Study', 'Business'],
  strengths: ['Durable', 'Portable', 'Value for Money', 'Easy to Use'],
  ratings: ['Build Quality', 'Performance', 'Portability', 'Value for Money']
};

const specPresets = {
  'Laptops': ['Processor', 'RAM', 'Storage', 'Display', 'Battery', 'OS', 'Weight'],
  'Phones': ['Processor', 'RAM', 'Storage', 'Display', 'Battery', 'OS', 'Camera', 'Network'],
  'Tablets': ['Processor', 'RAM', 'Storage', 'Display', 'Battery', 'OS', 'Stylus Support'],
  'Audio': ['Audio Chip', 'Battery', 'Charging', 'Connectivity', 'Driver Size'],
  'Keyboards': ['Layout', 'Switch Type', 'Connectivity', 'Backlight', 'Battery'],
  'Projectors': ['Resolution', 'Brightness', 'Connectivity', 'Lamp Life', 'Throw Ratio'],
  'Batteries & Power Banks': ['Capacity', 'Output Ports', 'Fast Charging', 'Weight'],
  'Storage Devices': ['Capacity', 'Interface', 'Read Speed', 'Write Speed', 'Form Factor'],
};

// Computed lists based on currently selected category
const currentUseCases = computed(() => {
  return categoryMetadataRules[form.category]?.useCases || defaultMetadataRule.useCases;
});

const currentStrengths = computed(() => {
  return categoryMetadataRules[form.category]?.strengths || defaultMetadataRule.strengths;
});

const currentRatings = computed(() => {
  return categoryMetadataRules[form.category]?.ratings || defaultMetadataRule.ratings;
});

// Pre-populate hardware specifications keys
const populateDefaultSpecs = (category) => {
  const keys = specPresets[category] || ['Model', 'Connectivity', 'Battery', 'Weight'];
  const obj = {};
  keys.forEach(k => {
    obj[k] = '';
  });
  form.specifications = JSON.stringify(obj);
};

// Adjust metadata to match new category rules
const adjustMetadataForCategory = (category) => {
  const rules = categoryMetadataRules[category] || defaultMetadataRule;
  
  // Clean up selected use cases and strengths
  form.useCases = form.useCases.filter(uc => rules.useCases.includes(uc));
  form.strengths = form.strengths.filter(st => rules.strengths.includes(st));
  
  // Filter/initialize ratings
  const newRatings = {};
  rules.ratings.forEach(cat => {
    newRatings[cat] = form.ratings[cat] ?? 5.0;
  });
  form.ratings = newRatings;
};

// Initialization state tracking
let isInitializing = true;

// Image Upload / Link states
const imagesList = ref([]);
const activeUploadMode = ref('upload'); // 'upload' or 'link'
const manualUrlInput = ref('');
const isUploading = ref(false);
const uploadError = ref('');
const isDragging = ref(false);

const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const isCloudinaryConfigured = ref(
  cloudinaryCloudName && 
  cloudinaryCloudName !== 'your_cloud_name_here' && 
  cloudinaryUploadPreset && 
  cloudinaryUploadPreset !== 'your_unsigned_preset_here'
);

// File upload handler
const handleFileUpload = async (event) => {
  const files = event.target.files || event.dataTransfer.files;
  if (!files || files.length === 0) return;
  
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Please select a valid image file.';
    return;
  }

  isUploading.value = true;
  uploadError.value = '';

  if (isCloudinaryConfigured.value) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryUploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload to Cloudinary failed');
      }

      const data = await response.json();
      if (data.secure_url) {
        imagesList.value.push(data.secure_url);
      } else {
        throw new Error('No secure url in Cloudinary response');
      }
    } catch (err) {
      console.error('Cloudinary upload error:', err);
      uploadError.value = 'Failed to upload to Cloudinary. Falling back to local simulator...';
      simulateLocalUpload(file);
    } finally {
      isUploading.value = false;
    }
  } else {
    simulateLocalUpload(file);
  }
};

const simulateLocalUpload = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    imagesList.value.push(e.target.result);
    isUploading.value = false;
  };
  reader.readAsDataURL(file);
};

const addManualUrl = () => {
  const url = manualUrlInput.value.trim();
  if (!url) return;
  
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:image/')) {
    uploadError.value = 'Please enter a valid URL (starting with http:// or https://)';
    return;
  }
  
  imagesList.value.push(url);
  manualUrlInput.value = '';
  uploadError.value = '';
};

const removeImage = (index) => {
  imagesList.value.splice(index, 1);
};

onMounted(async () => {
  await loadCategories();
  await loadBrands();

  if (props.initialData) {
    Object.assign(form, {
      title: props.initialData.title || '',
      brand: props.initialData.brand || '',
      category: props.initialData.category || 'Laptops',
      price: props.initialData.price || 0,
      description: props.initialData.description || '',
      specifications: props.initialData.specifications || '{}',
      is_available: props.initialData.is_available !== false,
      useCases: Array.isArray(props.initialData.useCases) ? [...props.initialData.useCases] : [],
      strengths: Array.isArray(props.initialData.strengths) ? [...props.initialData.strengths] : []
    });

    if (props.initialData.images) {
      if (Array.isArray(props.initialData.images)) {
        imagesList.value = [...props.initialData.images];
      } else {
        try {
          const parsed = JSON.parse(props.initialData.images);
          imagesList.value = Array.isArray(parsed) ? parsed : [props.initialData.images];
        } catch (e) {
          imagesList.value = [props.initialData.images];
        }
      }
    }

    if (props.initialData.ratings) {
      const activeRules = categoryMetadataRules[form.category] || defaultMetadataRule;
      activeRules.ratings.forEach(cat => {
        form.ratings[cat] = props.initialData.ratings[cat] ?? 5.0;
      });
    }
  } else {
    populateDefaultSpecs(form.category);
    const initialRules = categoryMetadataRules[form.category] || defaultMetadataRule;
    initialRules.ratings.forEach(cat => {
      form.ratings[cat] = 5.0;
    });
  }

  isInitializing = false;
});

watch(() => form.category, (newCat) => {
  if (isInitializing) return;
  populateDefaultSpecs(newCat);
  adjustMetadataForCategory(newCat);
});

const handleSubmit = () => {
  const match = existingBrands.value.find(b => b.name.toLowerCase() === form.brand.trim().toLowerCase());
  
  const payload = {
    ...form,
    brand_id: match ? match.id : null,
    brand_name: match ? null : form.brand.trim(),
    brand: form.brand.trim(),
    images: JSON.stringify(imagesList.value)
  };
  emit('submit', payload);
};
</script>

<template>
  <form class="product-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <!-- Left Column: Core Fields -->
      <div class="form-column">
        <h3 class="form-section-title">Core Information</h3>
        
        <div class="form-group">
          <label class="form-label">Product Title</label>
          <input v-model="form.title" type="text" required placeholder="e.g. Apple MacBook Air M2 (2022)" class="form-input" />
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Brand</label>
            <input 
              v-model="form.brand" 
              list="brands-datalist" 
              type="text" 
              required 
              placeholder="e.g. Apple" 
              class="form-input" 
            />
            <datalist id="brands-datalist">
              <option v-for="b in existingBrands" :key="b.id" :value="b.name"></option>
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select v-model="form.category" class="form-select" required>
              <option v-for="cat in categoriesList" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Price (₦ Naira)</label>
            <input v-model.number="form.price" type="number" required placeholder="e.g. 395000" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Availability Status</label>
            <label class="checkbox-label availability-label-toggle">
              <input v-model="form.is_available" type="checkbox" class="checkbox-input" />
              <span>Available in Storefront</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Product Images</label>
          
          <div class="upload-mode-selector">
            <button 
              type="button" 
              class="mode-tab-btn" 
              :class="{ active: activeUploadMode === 'upload' }" 
              @click="activeUploadMode = 'upload'"
            >
              Upload File
            </button>
            <button 
              type="button" 
              class="mode-tab-btn" 
              :class="{ active: activeUploadMode === 'link' }" 
              @click="activeUploadMode = 'link'"
            >
              Image Link
            </button>
          </div>

          <!-- Upload File Panel -->
          <div v-if="activeUploadMode === 'upload'" class="upload-panel-container">
            <div 
              class="drag-drop-zone"
              :class="{ dragging: isDragging, uploading: isUploading }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="isDragging = false; handleFileUpload($event)"
            >
              <input 
                type="file" 
                id="image-file-input" 
                accept="image/*" 
                class="file-input-hidden" 
                @change="handleFileUpload" 
                :disabled="isUploading"
              />
              <label for="image-file-input" class="file-input-label">
                <div class="upload-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <span class="upload-main-text">
                  {{ isUploading ? 'Uploading Image...' : 'Drag & drop image, or browse' }}
                </span>
                <span v-if="!isUploading" class="upload-sub-text">PNG, JPG, JPEG, GIF up to 5MB</span>
                <span v-if="!isCloudinaryConfigured && !isUploading" class="config-warn-text">
                  ⚠️ Cloudinary config not found. Simulating client-side upload...
                </span>
              </label>
            </div>
          </div>

          <!-- Image Link Panel -->
          <div v-if="activeUploadMode === 'link'" class="link-panel-container">
            <div class="link-input-row">
              <input 
                v-model="manualUrlInput" 
                type="text" 
                placeholder="Paste image URL here..." 
                class="form-input url-text-input" 
                @keydown.enter.prevent="addManualUrl"
              />
              <button type="button" class="btn btn-purple add-url-btn" @click="addManualUrl">Add URL</button>
            </div>
          </div>

          <!-- Upload Error Message -->
          <p v-if="uploadError" class="upload-error-msg">{{ uploadError }}</p>

          <!-- Shared Thumbnail Gallery -->
          <div class="thumbnail-gallery-title" v-if="imagesList.length > 0">
            Current Images ({{ imagesList.length }})
          </div>
          <div class="thumbnail-grid" v-if="imagesList.length > 0">
            <div v-for="(img, index) in imagesList" :key="index" class="thumbnail-card">
              <img :src="img" class="thumbnail-image" />
              <button type="button" class="remove-thumbnail-btn" @click="removeImage(index)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea v-model="form.description" rows="4" placeholder="Brief gadget review or description..." class="form-input"></textarea>
        </div>



        <!-- Specs editor -->
        <div class="form-group">
          <SpecFieldEditor v-model="form.specifications" />
        </div>
      </div>

      <!-- Right Column: Recommendation Engine Metadata Tuning -->
      <div class="form-column metadata-column">
        <h3 class="form-section-title">Recommendation Metadata</h3>
        <p class="section-desc">Tune these parameters to train the AI Recommender engine on this specific device.</p>

        <!-- Use Cases checkboxes -->
        <div class="form-group">
          <label class="form-label">Recommended Use Cases</label>
          <div class="checkbox-grid">
            <label v-for="uc in currentUseCases" :key="uc" class="checkbox-pill">
              <input type="checkbox" :value="uc" v-model="form.useCases" />
              <span>{{ uc }}</span>
            </label>
          </div>
        </div>

        <!-- Strengths checkboxes -->
        <div class="form-group">
          <label class="form-label">Device Strengths</label>
          <div class="checkbox-grid">
            <label v-for="st in currentStrengths" :key="st" class="checkbox-pill">
              <input type="checkbox" :value="st" v-model="form.strengths" />
              <span>{{ st }}</span>
            </label>
          </div>
        </div>

        <!-- Score Ratings sliders -->
        <div class="form-group">
          <label class="form-label">Engine Feature Scores (1.0 - 10.0)</label>
          <div class="ratings-sliders-container">
            <div v-for="cat in currentRatings" :key="cat" class="slider-row">
              <div class="slider-label-row">
                <span class="slider-cat">{{ cat }}</span>
                <span class="slider-value">{{ (form.ratings[cat] !== undefined ? form.ratings[cat] : 5.0).toFixed(1) }}</span>
              </div>
              <input 
                :value="form.ratings[cat] !== undefined ? form.ratings[cat] : 5.0"
                @input="form.ratings[cat] = Number($event.target.value)"
                type="range" 
                min="1.0" 
                max="10.0" 
                step="0.5" 
                class="rating-range-slider"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions row -->
    <div class="form-actions-row">
      <button type="button" class="btn btn-outlined" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="btn btn-yellow">{{ submitLabel }}</button>
    </div>
  </form>
</template>

<style scoped>
.product-form {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  padding: 32px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  margin-bottom: 32px;
}

.form-column {
  display: flex;
  flex-direction: column;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 12px;
}

.section-desc {
  font-size: 13px;
  color: var(--color-muted-grey);
  margin-bottom: 20px;
}

.text-area-images {
  height: 80px;
  resize: vertical;
}

.availability-label-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  cursor: pointer;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-slate-headings);
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-navy);
}

/* Metadata selectors */
.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background-color: var(--color-bg);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
}

.checkbox-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox-pill input {
  accent-color: var(--color-purple);
}

.checkbox-pill:has(input:checked) {
  border-color: var(--color-purple);
  background-color: var(--color-lavender);
  color: var(--color-purple);
}

/* Rating Sliders */
.ratings-sliders-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--color-bg);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}

.slider-cat {
  color: var(--color-slate-headings);
}

.slider-value {
  color: var(--color-purple);
}

.rating-range-slider {
  width: 100%;
  accent-color: var(--color-purple);
  cursor: pointer;
}

.form-actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  border-top: 1px solid var(--color-border-light);
  padding-top: 24px;
}

@media (max-width: 992px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

/* Upload Toggler CSS */
.upload-mode-selector {
  display: flex;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 12px;
  width: 100%;
}

.mode-tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-muted-grey);
  transition: all 0.2s ease;
  text-align: center;
}

.mode-tab-btn.active {
  background-color: var(--color-white);
  color: var(--color-navy);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Drag-Drop Zone */
.drag-drop-zone {
  border: 2px dashed var(--color-border-light);
  background-color: var(--color-bg);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.2s ease;
  position: relative;
}

.drag-drop-zone.dragging {
  border-color: var(--color-purple);
  background-color: var(--color-lavender);
}

.drag-drop-zone.uploading {
  opacity: 0.7;
  cursor: not-allowed;
}

.file-input-hidden {
  display: none;
}

.file-input-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  width: 100%;
}

.upload-icon {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  padding: 10px;
  border-radius: 50%;
  color: var(--color-muted-grey);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drag-drop-zone:hover .upload-icon {
  color: var(--color-purple);
  border-color: var(--color-purple);
  transform: translateY(-2px);
}

.upload-main-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-slate-headings);
}

.upload-sub-text {
  font-size: 12px;
  color: var(--color-muted-grey);
}

.config-warn-text {
  font-size: 11px;
  color: var(--color-gold);
  font-weight: 500;
  margin-top: 4px;
}

/* Image Link Row */
.link-input-row {
  display: flex;
  gap: 8px;
}

.url-text-input {
  flex: 1;
  margin-bottom: 0 !important;
}

.add-url-btn {
  background-color: var(--color-purple);
  color: var(--color-white);
  border: none;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.add-url-btn:hover {
  background-color: var(--color-purple-hover);
}

.upload-error-msg {
  font-size: 12px;
  color: var(--color-red);
  margin-top: 8px;
  font-weight: 500;
}

/* Thumbnails */
.thumbnail-gallery-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-slate-headings);
  margin-top: 20px;
  margin-bottom: 8px;
}

.thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  margin-top: 8px;
}

.thumbnail-card {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-bg);
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-thumbnail-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: rgba(239, 68, 68, 0.9);
  color: var(--color-white);
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-thumbnail-btn:hover {
  background-color: var(--color-red);
  transform: scale(1.1);
}
</style>
