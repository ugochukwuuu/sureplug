<script setup>
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat';
import ChatInterface from '../components/ChatInterface.vue';

const route = useRoute();
const chatStore = useChatStore();

// Pre-fill query if coming from another screen (like homepage search)
onMounted(() => {
  if (route.query.q || route.query.query) {
    const q = route.query.q || route.query.query;
    chatStore.sendMessage(q);
  }
});
</script>

<template>
  <div class="ai-recommender-view">
    <ChatInterface />
  </div>
</template>

<style scoped>
.ai-recommender-view {
  background-color: var(--color-white);
  height: calc(100vh - 72px); /* Fills full height below navbar */
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
