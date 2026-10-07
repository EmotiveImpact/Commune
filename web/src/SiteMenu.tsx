import { useEffect, useState } from 'react';
import { BrandWordmark } from './BrandWordmark';
import './site-menu.css';

const signup = 'https://app.ourcommune.io/signup';
const login = 'https://app.ourcommune.io/login';
export const siteNav = [
  ['How it works', '/how-it-works.html'],
  ['Life together', '/life-together.html'],
  ['Pricing', '/pricing.html'],
  ['Journal', '/journal.html'],
  ['About', '/about.html'],
] as const;

/** Phone menu state: locks page scroll while open, closes on Escape or when the window widens past phone size. */
export function useSiteMenu() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const wide = window.matchMedia('(min-width: 801px)');
    const onWide = () => { if (wide.matches) setOpen(false); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    wide.addEventListener('change', onWide);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onKey); wide.removeEventListener('change', onWide); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('has-site-menu', open);
    return () => document.documentElement.classList.remove('has-site-menu');
  }, [open]);
  return { open, setOpen, scrolled };
}

/** The phone top bar and full-screen menu. Desktop keeps each page's own header. */
export function SiteMenu({ open, setOpen, scrolled, current, tone = 'light' }: { open: boolean; setOpen: (open: boolean) => void; scrolled: boolean; current?: string; tone?: 'light' | 'photo' }) {
  const close = () => setOpen(false);
  return <div className={`site-menu site-menu--${tone}${open ? ' is-open' : ''}${scrolled ? ' is-scrolled' : ''}`}>
    <div className="site-menu__bar">
      <BrandWordmark />
      <button className="site-menu__toggle" type="button" aria-expanded={open} aria-controls="site-menu-panel" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
    </div>
    <nav id="site-menu-panel" className="site-menu__panel" aria-label="Main navigation" hidden={!open}>
      <div className="site-menu__links">
        {siteNav.map(([name, href]) => <a key={href} href={href} aria-current={href === current ? 'page' : undefined} onClick={close}>{name}</a>)}
      </div>
      <div className="site-menu__actions">
        <a className="l-button site-menu__login" href={login}>Log in</a>
        <a className="l-button site-menu__trial" href={signup}>Start free trial</a>
      </div>
    </nav>
  </div>;
}
