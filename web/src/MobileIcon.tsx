import type { ReactNode } from 'react';

export type IconName = 'home' | 'money' | 'checklist' | 'grid' | 'plus' | 'chevron' | 'arrow' | 'close' | 'bell' | 'receipt' | 'calendar' | 'people' | 'pin' | 'check' | 'wallet' | 'clock' | 'spark';

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 21v-7h6v7" /></>,
    money: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M16 12h.01M7 9h5M7 13h3" /></>,
    checklist: <><path d="M9 5h12M9 12h12M9 19h12" /><path d="m3 5 1.4 1.4L7 3.8M3 12l1.4 1.4L7 10.8M3 19l1.4 1.4L7 17.8" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    plus: <path d="M12 4v16M4 12h16" />, chevron: <path d="m6 9 6 6 6-6" />, arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="M5 5 19 19M19 5 5 19" />, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" /><path d="M8 8h8M8 12h6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-3-5" /></>,
    pin: <><path d="m8 3 8 8M14 3l7 7-3 1-3 3-2 7-2-7-3-3-3 1 3-9z" /></>,
    check: <path d="m4 12 5 5L20 6" />, wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 15h2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    spark: <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
