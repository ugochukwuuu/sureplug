import { defineStore } from 'pinia';

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [
      {
        id: 'greet',
        sender: 'ai',
        text: 'Hey! What are you looking for today? Tell me your budget, what you\'ll use it for, and I\'ll find your best match.',
        timestamp: '10:30 AM',
        recommendations: null
      }
    ],
    isTyping: false
  }),
  actions: {
    async sendMessage(text) {
      if (!text.trim()) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add user message
      const userMsgId = 'user-' + Date.now();
      this.messages.push({
        id: userMsgId,
        sender: 'user',
        text: text,
        timestamp: timeStr
      });

      this.isTyping = true;

      try {
        // Send request to API recommender endpoint
        const response = await fetch('/api/ai/recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: text, history: this.messages })
        });

        if (response.ok) {
          const data = await response.json();
          // Add AI Response message
          this.messages.push({
            id: 'ai-' + Date.now(),
            sender: 'ai',
            text: data.text,
            timestamp: timeStr,
            recommendations: data.recommendations || []
          });
        } else {
          throw new Error('API server returned error');
        }
      } catch (e) {
        console.warn('Backend recommender API not ready yet, using mock engine responses...', e);
        // Fallback for Batch 1 UI/UX checking
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate typing duration
        
        let responseText = 'Got it! Based on your request, I searched our live catalog and found some great match recommendations.';
        let mockRecs = [];
        
        const lowerText = text.toLowerCase();
        if (lowerText.includes('laptop') || lowerText.includes('macbook') || lowerText.includes('coding') || lowerText.includes('design')) {
          responseText = 'Got it! Based on your graphic design and editing needs, here are two excellent high-performance laptop recommendations from our database:';
          mockRecs = [
            {
              id: 1,
              title: 'MacBook Air M2',
              price: 395000,
              images: ['https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500'],
              condition: 'New',
              category: 'Laptops',
              matchPercentage: 94,
              bulletPoints: ['Perfect for design work', 'Best value at this budget.']
            },
            {
              id: 3,
              title: 'ASUS ROG Zephyrus G14',
              price: 389000,
              images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500'],
              condition: 'New',
              category: 'Laptops',
              matchPercentage: 90,
              bulletPoints: ['Excellent for video editing and GPU rendering', '16GB RAM + 1TB SSD storage', 'High-performance, portable gaming design']
            }
          ];
        } else if (lowerText.includes('phone') || lowerText.includes('iphone') || lowerText.includes('samsung')) {
          responseText = 'Here are the best verified mobile devices matching your request:';
          mockRecs = [
            {
              id: 2,
              title: 'iPhone 12 128GB',
              price: 620000,
              images: ['https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500'],
              condition: 'New',
              category: 'Phones',
              matchPercentage: 92,
              bulletPoints: ['Vibrant Super Retina display', 'Dual-camera with Night Mode', 'Compact and highly portable for lectures']
            }
          ];
        }

        this.messages.push({
          id: 'ai-mock-' + Date.now(),
          sender: 'ai',
          text: responseText,
          timestamp: timeStr,
          recommendations: mockRecs
        });
      } finally {
        this.isTyping = false;
      }
    },
    resetChat() {
      this.messages = [
        {
          id: 'greet',
          sender: 'ai',
          text: 'Hey! What are you looking for today? Tell me your budget, what you\'ll use it for, and I\'ll find your best match.',
          timestamp: '10:30 AM',
          recommendations: null
        }
      ];
      this.isTyping = false;
    }
  }
});
