<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useChatStore } from '../stores/chat';
import { useRouter } from 'vue-router';
import { brand } from '@/config/brand.js';

const chatStore = useChatStore();
const router = useRouter();
const inputMessage = ref('');
const chatScrollContainer = ref(null);

const promptChips = [
  'Laptop for school',
  'Phone under ₦200k',
  'Best tablet for Netflix'
];

const scrollToBottom = async () => {
  await nextTick();
  if (chatScrollContainer.value) {
    chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight;
  }
};

onMounted(() => {
  scrollToBottom();
});

// Watch messages and scroll down
watch(() => chatStore.messages.length, () => {
  scrollToBottom();
}, { deep: true });

// Also scroll down when typing indicator state toggles
watch(() => chatStore.isTyping, () => {
  scrollToBottom();
});

const handleSend = async () => {
  const text = inputMessage.value.trim();
  if (!text) return;
  inputMessage.value = '';
  await chatStore.sendMessage(text);
};

const handleChipClick = async (chipText) => {
  inputMessage.value = chipText;
  await handleSend();
};

const navigateToProduct = (id) => {
  router.push(`/product/${id}`);
};

const formatPrice = (val) => {
  return '₦' + Number(val).toLocaleString('en-NG');
};

const getImageUrl = (images) => {
  if (Array.isArray(images)) return images[0] || '';
  try {
    const parsed = JSON.parse(images || '[]');
    return parsed[0] || '';
  } catch (e) {
    return images || '';
  }
};
</script>

<template>
  <div class="chat-console">
    <!-- Header -->
    <div class="chat-header">
      <div class="chat-header-left">
        <img :src="brand.logo" :alt="`${brand.name} Logo`" class="logo-image-sub" />
        <div class="chat-header-divider"></div>
        <span class="chat-header-label">AI Recommender</span>
      </div>
      <div class="chat-header-right">
        Describe what you need. Our AI will find your best match.
      </div>
    </div>

    <!-- Message Area -->
    <div ref="chatScrollContainer" class="chat-messages-container">
      <div class="chat-messages-inner">
        <div v-for="msg in chatStore.messages" :key="msg.id" class="message-bubble-wrapper" :class="msg.sender">
          <!-- Avatar Icon -->
          <div class="message-avatar">
            <div v-if="msg.sender === 'ai'" class="ai-avatar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8V4H8"></path>
                <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                <path d="M2 14h2"></path>
                <path d="M20 14h2"></path>
                <path d="M15 13v2"></path>
                <path d="M9 13v2"></path>
              </svg>
            </div>
            <div v-else class="user-avatar-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
          </div>

          <div class="message-body">
            <div class="message-text-bubble">
              <p>{{ msg.text }}</p>
            </div>

            <!-- Prompt Chips Row -->
            <div v-if="msg.id === 'greet' && chatStore.messages.length === 1" class="prompt-chips-row">
              <button v-for="chip in promptChips" :key="chip" class="prompt-chip" @click="handleChipClick(chip)">
                {{ chip }}
              </button>
            </div>

            <!-- Recommended items in AI message bubbles -->
            <div v-if="msg.recommendations && msg.recommendations.length > 0" class="chat-recommendations-list">
              <div v-for="rec in msg.recommendations" :key="rec.id" class="mockup-rec-card" @click="navigateToProduct(rec.id)">
                <div class="mockup-rec-main">
                  <img :src="getImageUrl(rec.images)" :alt="rec.title" class="mockup-rec-img" />
                  <div class="mockup-rec-details">
                    <h4 class="mockup-rec-title">{{ rec.title }}</h4>
                    <div class="mockup-rec-price">{{ formatPrice(rec.price) }}</div>
                    <span class="mockup-rec-badge">{{ rec.matchPercentage || rec.match_score || 94 }}% Match</span>
                  </div>
                </div>
                <ul class="mockup-rec-bullets">
                  <li v-for="(bullet, index) in (rec.bulletPoints || ['Perfect for design work', 'Best value at this budget.'])" :key="index">
                    {{ bullet }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div v-if="chatStore.isTyping" class="message-bubble-wrapper ai typing">
          <div class="message-avatar">
            <div class="ai-avatar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8V4H8"></path>
                <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                <path d="M2 14h2"></path>
                <path d="M20 14h2"></path>
                <path d="M15 13v2"></path>
                <path d="M9 13v2"></path>
              </svg>
            </div>
          </div>
          <div class="message-body">
            <div class="message-text-bubble typing-bubble">
              <div class="typing-dots">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Footer -->
    <div class="chat-input-area">
      <form class="chat-input-form" @submit.prevent="handleSend">
        <input v-model="inputMessage" type="text" placeholder="Describe what you need..." class="chat-text-input" />
        <button type="submit" class="chat-send-btn" :disabled="chatStore.isTyping" aria-label="Send query">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-console {
  background-color: var(--color-white);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.chat-header {
  background-color: #F8FAFC; /* very light grey slate-50 background */
  border-bottom: 1px solid var(--color-border-light);
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-image-sub {
  height: 26px;
  width: auto;
  object-fit: contain;
  display: block;
}

.chat-header-divider {
  width: 1px;
  height: 16px;
  background-color: #CBD5E1; /* slate-300 vertical divider line */
}

.chat-header-label {
  font-family: var(--font-headings);
  font-size: 14px;
  font-weight: 600; /* Plus Jakarta Sans SemiBold */
  color: var(--color-navy); /* Near Black */
}

.chat-header-right {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 400; /* Plus Jakarta Sans Regular */
  color: var(--color-muted-grey);
}

/* Chat Messages Flow */
.chat-messages-container {
  flex: 1;
  padding: 32px 24px;
  background-color: var(--color-white);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.chat-messages-inner {
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message-bubble-wrapper {
  display: flex;
  gap: 12px;
  max-width: 85%;
}

.message-bubble-wrapper.ai {
  align-self: flex-start;
}

.message-bubble-wrapper.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-avatar-icon {
  width: 100%;
  height: 100%;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.user-avatar-icon {
  width: 100%;
  height: 100%;
  background-color: var(--color-navy);
  color: var(--color-white);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.message-text-bubble {
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--color-slate-headings);
  width: fit-content;
}

.ai .message-text-bubble {
  background-color: #F1F5F9; /* light grey bubble */
  border-top-left-radius: 2px;
}

.user .message-text-bubble {
  background-color: var(--color-navy); /* Deep Indigo */
  color: var(--color-white);
  border-top-right-radius: 2px;
  align-self: flex-end;
}

/* Prompt Chips */
.prompt-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.prompt-chip {
  padding: 8px 16px;
  border-radius: 100px;
  border: 1px solid var(--color-yellow);
  background-color: var(--color-white);
  color: var(--color-slate-headings);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.prompt-chip:hover {
  background-color: rgba(255, 184, 0, 0.05);
}

/* Recommendation Match Card */
.chat-recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin-top: 4px;
}

.mockup-rec-card {
  background-color: var(--color-white);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.mockup-rec-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-yellow);
}

.mockup-rec-main {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  align-items: center;
}

.mockup-rec-img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 6px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.mockup-rec-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mockup-rec-title {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-slate-headings);
  margin: 0;
}

.mockup-rec-price {
  font-size: 13px;
  font-weight: 800;
  color: #000;
}

.mockup-rec-badge {
  background-color: var(--color-yellow);
  color: var(--color-navy);
  font-size: 9px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 6px;
  width: fit-content;
}

.mockup-rec-bullets {
  list-style: none;
  font-size: 11px;
  color: var(--color-slate-body);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 0;
  margin: 0;
  border-top: 1px dashed var(--color-border-light);
  padding-top: 8px;
}

.mockup-rec-bullets li::before {
  content: '• ';
  color: var(--color-navy);
  font-weight: 900;
}

/* Typing indicator */
.typing-bubble {
  padding: 10px 14px;
  display: flex;
  align-items: center;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  background-color: var(--color-muted-grey);
  border-radius: 50%;
  animation: typing 1s infinite alternate;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  from { opacity: 0.3; transform: translateY(0); }
  to { opacity: 1; transform: translateY(-3px); }
}

/* Input Bar */
.chat-input-area {
  background-color: var(--color-white);
  border-top: 1px solid var(--color-border-light);
  padding: 20px 24px;
  width: 100%;
}

.chat-input-form {
  display: flex;
  position: relative;
  align-items: center;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

.chat-text-input {
  width: 100%;
  padding: 14px 60px 14px 18px;
  border-radius: 100px;
  border: 1px solid var(--color-border-light);
  outline: none;
  font-size: 13.5px;
  color: var(--color-slate-headings);
  background-color: var(--color-white);
}

.chat-send-btn {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--color-yellow);
  color: var(--color-navy);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s ease;
}

.chat-send-btn:hover {
  background-color: var(--color-yellow-hover);
}

.chat-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 576px) {
  .chat-messages-container {
    padding: 16px 12px;
  }
  .mockup-rec-main {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }
  .mockup-rec-badge {
    margin: 4px auto 0 auto;
  }
}
</style>
