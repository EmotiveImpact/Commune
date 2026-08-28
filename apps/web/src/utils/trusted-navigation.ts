const TRUSTED_EXTERNAL_HOST_SUFFIXES = ['stripe.com'] as const;

export function assertTrustedRedirectUrl(
  url: string,
  currentOrigin = window.location.origin,
): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url, currentOrigin);
  } catch {
    throw new Error('Billing service returned an invalid redirect URL.');
  }

  if (parsedUrl.origin === currentOrigin) {
    return parsedUrl.toString();
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isTrustedExternalHost = TRUSTED_EXTERNAL_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );

  if (parsedUrl.protocol !== 'https:' || !isTrustedExternalHost) {
    throw new Error('Billing service returned an untrusted redirect URL.');
  }

  return parsedUrl.toString();
}

export function redirectToTrustedUrl(url: string): void {
  window.location.assign(assertTrustedRedirectUrl(url));
}
