import * as kora from './kora.js';

/**
 * Dynamically resolves the active payment provider module
 */
export function getProvider(name = process.env.PAYMENT_PROVIDER || 'kora') {
  if (name.toLowerCase() === 'kora') {
    return kora;
  }
  throw new Error(`Unsupported payment provider: ${name}`);
}
