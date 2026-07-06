<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '{}'
  }
});

const emit = defineEmits(['update:modelValue']);

// Local array of key-value pairs
const specList = ref([]);

// Parse incoming specifications JSON string
const parseSpecs = (jsonStr) => {
  try {
    const obj = JSON.parse(jsonStr || '{}');
    specList.value = Object.entries(obj).map(([key, value]) => ({ key, value }));
  } catch (e) {
    specList.value = [];
  }
};

// Initial parse
parseSpecs(props.modelValue);

// Watch for external model changes
watch(() => props.modelValue, (newVal) => {
  const currentJson = getJsonString();
  if (newVal !== currentJson) {
    parseSpecs(newVal);
  }
});

const getJsonString = () => {
  const obj = {};
  specList.value.forEach(item => {
    if (item.key.trim()) {
      obj[item.key.trim()] = item.value.trim();
    }
  });
  return JSON.stringify(obj);
};

const updateParent = () => {
  emit('update:modelValue', getJsonString());
};

const addField = () => {
  specList.value.push({ key: '', value: '' });
  updateParent();
};

const removeField = (index) => {
  specList.value.splice(index, 1);
  updateParent();
};
</script>

<template>
  <div class="spec-editor">
    <div class="spec-header-row">
      <span class="spec-label">Hardware Specifications</span>
      <button type="button" class="btn btn-outlined spec-add-btn" @click="addField">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Row
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="specList.length === 0" class="spec-empty-state">
      No specifications added yet. Add a row to specify details (e.g. RAM, Storage, OS).
    </div>

    <!-- Dynamic list -->
    <div v-else class="spec-fields-container">
      <div v-for="(spec, index) in specList" :key="index" class="spec-field-row">
        <input 
          v-model="spec.key" 
          type="text" 
          placeholder="Specification (e.g. RAM)" 
          class="form-input spec-key-input"
          @input="updateParent"
        />
        <input 
          v-model="spec.value" 
          type="text" 
          placeholder="Value (e.g. 16GB)" 
          class="form-input spec-val-input"
          @input="updateParent"
        />
        <button type="button" class="spec-delete-btn" @click="removeField(index)" aria-label="Delete specification">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spec-editor {
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--color-bg);
}

.spec-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.spec-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-slate-headings);
}

.spec-add-btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
}

.spec-empty-state {
  text-align: center;
  font-size: 13px;
  color: var(--color-muted-grey);
  padding: 16px;
  border: 1px dashed var(--color-border-light);
  border-radius: 6px;
  background-color: var(--color-white);
}

.spec-fields-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-field-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.spec-key-input {
  flex: 1;
}

.spec-val-input {
  flex: 2;
}

.spec-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.spec-delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.05);
}
</style>
