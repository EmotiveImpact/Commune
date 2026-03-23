import {
  IconArrowsExchange,
  IconChartBar,
  IconDashboard,
  IconReceipt,
  IconFileText,
  IconUsers,
  IconHistory,
  IconPigMoney,
  IconRepeat,
  IconTemplate,
} from '@tabler/icons-react';

export interface NavLink {
  label: string;
  to: string;
  icon: React.ReactNode;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

/** Top-level link — always visible, not inside any group */
export const pinnedLinks: NavLink[] = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} /> },
];

/** Collapsible nav groups */
export const navGroups: NavGroup[] = [
  {
    label: 'Money',
    links: [
      { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} /> },
      { label: 'Recurring', to: '/recurring', icon: <IconRepeat size={20} /> },
      { label: 'Templates', to: '/templates', icon: <IconTemplate size={20} /> },
      { label: 'Funds', to: '/funds', icon: <IconPigMoney size={20} /> },
    ],
  },
  {
    label: 'Insights',
    links: [
      { label: 'Overview', to: '/overview', icon: <IconArrowsExchange size={20} /> },
      { label: 'My Breakdown', to: '/breakdown', icon: <IconFileText size={20} /> },
      { label: 'Analytics', to: '/analytics', icon: <IconChartBar size={20} /> },
    ],
  },
  {
    label: 'Team',
    links: [
      { label: 'Members', to: '/members', icon: <IconUsers size={20} /> },
      { label: 'Activity', to: '/activity', icon: <IconHistory size={20} /> },
    ],
  },
];

/** Flat list of all links (for collapsed sidebar / tooltips) */
export const navLinks: NavLink[] = [
  ...pinnedLinks,
  ...navGroups.flatMap((g) => g.links),
];
