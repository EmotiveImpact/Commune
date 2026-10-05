export function BrandWordmark({ href = '/editorial.html' }: { href?: string }) {
  return <a className="l-wordmark" href={href} aria-label="Commune home">commune.</a>;
}
