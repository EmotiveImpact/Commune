import type { PaymentProvider } from '@commune/types';

export interface PaymentLinkConfig {
  provider: PaymentProvider;
  link: string;
}

export interface PaymentLinkResult {
  url: string;
  label: string;
  provider: PaymentProvider;
}

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  revolut: 'Pay with Revolut',
  monzo: 'Pay with Monzo',
  paypal: 'Pay with PayPal',
  bank_transfer: 'Bank transfer',
  other: 'Pay now',
};

const PROVIDER_DISPLAY: Record<PaymentProvider, string> = {
  revolut: 'Revolut',
  monzo: 'Monzo',
  paypal: 'PayPal',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

/**
 * Build a payment URL for a given provider + link + amount.
 *
 * Revolut: revolut.me links accept an amount query param
 * Monzo: monzo.me links accept an amount in the path
 * PayPal: paypal.me links accept an amount in the path
 * Bank transfer / other: just return the link as-is (no URL generation)
 */
export function buildPaymentUrl(
  config: PaymentLinkConfig,
  amount?: number,
): PaymentLinkResult | null {
  const { provider, link } = config;

  if (!link || link.trim() === '') return null;

  let url = link.trim();

  switch (provider) {
    case 'revolut': {
      // Normalize: accept "revolut.me/user", "@user", or full URL
      if (url.startsWith('@')) {
        url = `https://revolut.me/${url.slice(1)}`;
      } else if (!url.startsWith('http')) {
        url = url.startsWith('revolut.me') ? `https://${url}` : `https://revolut.me/${url}`;
      }
      // Revolut.me supports amount as a path segment: revolut.me/user/12.50
      if (amount && amount > 0) {
        url = `${url.replace(/\/+$/, '')}/${amount.toFixed(2)}`;
      }
      break;
    }

    case 'monzo': {
      // Normalize: accept "monzo.me/user" or full URL
      if (!url.startsWith('http')) {
        url = url.startsWith('monzo.me') ? `https://${url}` : `https://monzo.me/${url}`;
      }
      // Monzo.me supports amount query param: monzo.me/user?amount=12.50
      if (amount && amount > 0) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}amount=${amount.toFixed(2)}`;
      }
      break;
    }

    case 'paypal': {
      // Normalize: accept "paypal.me/user" or full URL
      if (!url.startsWith('http')) {
        url = url.startsWith('paypal.me') ? `https://${url}` : `https://paypal.me/${url}`;
      }
      // PayPal.me supports amount in path: paypal.me/user/12.50
      if (amount && amount > 0) {
        url = `${url.replace(/\/+$/, '')}/${amount.toFixed(2)}`;
      }
      break;
    }

    case 'bank_transfer':
    case 'other':
      // No URL generation — these are display-only
      break;
  }

  return {
    url,
    label: PROVIDER_LABELS[provider],
    provider,
  };
}

/**
 * Check if a provider supports clickable payment links.
 */
export function isClickableProvider(provider: PaymentProvider): boolean {
  return provider === 'revolut' || provider === 'monzo' || provider === 'paypal';
}

/**
 * Get the human-readable display name for a provider.
 */
export function getProviderDisplayName(provider: PaymentProvider): string {
  return PROVIDER_DISPLAY[provider] ?? 'Other';
}
