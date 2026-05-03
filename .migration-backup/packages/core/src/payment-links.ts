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
  wise: 'Pay with Wise',
  starling: 'Pay with Starling',
  venmo: 'Pay with Venmo',
  cash_app: 'Pay with Cash App',
  bank_transfer: 'Bank transfer',
  other: 'Pay now',
};

const PROVIDER_DISPLAY: Record<PaymentProvider, string> = {
  revolut: 'Revolut',
  monzo: 'Monzo',
  paypal: 'PayPal',
  wise: 'Wise',
  starling: 'Starling',
  venmo: 'Venmo',
  cash_app: 'Cash App',
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
      // Normalize: accept "revolut.me/user", "@user", just "user", or full URL
      if (url.startsWith('@')) {
        url = `https://revolut.me/${url.slice(1)}`;
      } else if (!url.startsWith('http')) {
        const stripped = url.replace(/^revolut\.me\//i, '');
        url = `https://revolut.me/${stripped}`;
      }
      // Revolut.me supports amount as a path segment: revolut.me/user/12.50
      if (amount && amount > 0) {
        url = `${url.replace(/\/+$/, '')}/${amount.toFixed(2)}`;
      }
      break;
    }

    case 'monzo': {
      // Normalize: accept "monzo.me/user", "Monzo.me/user", just "user", or full URL
      if (!url.startsWith('http')) {
        const stripped = url.replace(/^monzo\.me\//i, '');
        url = `https://monzo.me/${stripped}`;
      }
      // Monzo.me supports amount query param: monzo.me/user?amount=12.50
      if (amount && amount > 0) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}amount=${amount.toFixed(2)}`;
      }
      break;
    }

    case 'paypal': {
      // Normalize: accept "paypal.me/user", "PayPal.me/user", just "user", or full URL
      if (!url.startsWith('http')) {
        // Strip any "paypal.me/" prefix (case-insensitive) to get just the username
        const stripped = url.replace(/^paypal\.me\//i, '');
        url = `https://paypal.me/${stripped}`;
      }
      // PayPal.me supports amount in path: paypal.me/user/12.50
      if (amount && amount > 0) {
        url = `${url.replace(/\/+$/, '')}/${amount.toFixed(2)}`;
      }
      break;
    }

    case 'wise': {
      // Normalize: accept "wise.com/pay/user" or just username
      if (!url.startsWith('http')) {
        const stripped = url.replace(/^wise\.com\/pay\//i, '');
        url = `https://wise.com/pay/${stripped}`;
      }
      break;
    }

    case 'starling': {
      // Normalize: accept "settleup.starlingbank.com/user" or just username
      if (!url.startsWith('http')) {
        const stripped = url.replace(/^settleup\.starlingbank\.com\//i, '');
        url = `https://settleup.starlingbank.com/${stripped}`;
      }
      break;
    }

    case 'venmo': {
      // Normalize: accept "venmo.com/user" or just username
      if (!url.startsWith('http')) {
        const stripped = url.replace(/^venmo\.com\//i, '');
        url = `https://venmo.com/${stripped}`;
      }
      if (amount && amount > 0) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}txn=pay&amount=${amount.toFixed(2)}`;
      }
      break;
    }

    case 'cash_app': {
      // Normalize: accept "$cashtag", "cash.app/$tag" or just tag
      if (!url.startsWith('http')) {
        const stripped = url.replace(/^cash\.app\//i, '').replace(/^\$/, '');
        url = `https://cash.app/$${stripped}`;
      }
      if (amount && amount > 0) {
        url = `${url}/${amount.toFixed(2)}`;
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
  return provider !== 'bank_transfer' && provider !== 'other';
}

/**
 * Get the human-readable display name for a provider.
 */
export function getProviderDisplayName(provider: PaymentProvider): string {
  return PROVIDER_DISPLAY[provider] ?? 'Other';
}

/**
 * Revolut affiliate signup URL.
 * Replace with your actual Impact tracking link once approved.
 */
export const REVOLUT_AFFILIATE_URL = 'https://www.revolut.com/referral';

/**
 * Get provider-specific signup prompt for users who don't have the app.
 */
export function getProviderSignupPrompt(provider: PaymentProvider): {
  message: string;
  url: string;
  cta: string;
} | null {
  switch (provider) {
    case 'revolut':
      return {
        message: "Don't have Revolut? Sign up for a free account to pay instantly.",
        url: REVOLUT_AFFILIATE_URL,
        cta: 'Get Revolut free',
      };
    case 'monzo':
      return {
        message: "Don't have Monzo? You can still pay by card via the link above.",
        url: 'https://monzo.com',
        cta: 'Learn about Monzo',
      };
    default:
      return null;
  }
}
