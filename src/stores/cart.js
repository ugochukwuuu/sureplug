import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', {
  state: () => {
    let savedCart = [];
    try {
      const stored = localStorage.getItem('sureplug_cart');
      if (stored) {
        savedCart = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse saved cart from localStorage:', e);
    }
    return {
      cartItems: savedCart,
      deliveryMethod: 'standard',
      promoCode: '',
      promoDiscount: 0,
    };
  },
  getters: {
    cartCount: (state) => state.cartItems.reduce((acc, item) => acc + item.quantity, 0),
    subtotal: (state) => state.cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0),
    deliveryFee: (state) => (state.deliveryMethod === 'express' ? 2500 : 0),
    discountAmount: (state) => {
      const discount = (state.subtotal * state.promoDiscount) / 100;
      return Math.round(discount);
    },
    total: (state) => {
      const calculated = state.subtotal + state.deliveryFee - state.discountAmount;
      return calculated > 0 ? calculated : 0;
    }
  },
  actions: {
    addToCart(product, qty = 1) {
      const existing = this.cartItems.find(item => item.id === product.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        this.cartItems.push({
          id: product.id,
          title: product.title,
          price: product.price,
          image: Array.isArray(product.images) ? product.images[0] : (JSON.parse(product.images || '[]')[0] || ''),
          category: product.category,
          condition: product.condition,
          quantity: qty,
          specifications: product.specifications || '{}'
        });
      }
      localStorage.setItem('sureplug_cart', JSON.stringify(this.cartItems));
    },
    removeFromCart(productId) {
      this.cartItems = this.cartItems.filter(item => item.id !== productId);
      localStorage.setItem('sureplug_cart', JSON.stringify(this.cartItems));
    },
    updateQuantity(productId, qty) {
      const item = this.cartItems.find(item => item.id === productId);
      if (item) {
        item.quantity = qty;
        if (item.quantity <= 0) {
          this.removeFromCart(productId);
        } else {
          localStorage.setItem('sureplug_cart', JSON.stringify(this.cartItems));
        }
      }
    },
    applyPromoCode(code) {
      const cleanCode = code.toUpperCase().trim();
      if (cleanCode === 'SUG5') {
        this.promoCode = 'SUG5';
        this.promoDiscount = 5; // 5% discount
        return { success: true, message: '5% student discount applied!' };
      } else if (cleanCode === 'FREESHIP') {
        this.promoCode = 'FREESHIP';
        this.deliveryMethod = 'standard';
        return { success: true, message: 'Free Standard Delivery applied!' };
      } else {
        return { success: false, message: 'Invalid promo code' };
      }
    },
    removePromo() {
      this.promoCode = '';
      this.promoDiscount = 0;
    },
    clearCart() {
      this.cartItems = [];
      this.deliveryMethod = 'standard';
      this.promoCode = '';
      this.promoDiscount = 0;
      localStorage.setItem('sureplug_cart', JSON.stringify(this.cartItems));
    }
  }
});
