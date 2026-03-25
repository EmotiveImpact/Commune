import {
  IconArrowsExchange,
  IconChartBar,
  IconChartPie,
  IconCoin,
  IconDashboard,
  IconHome2,
  IconReceipt,
  IconFileText,
  IconUsers,
  IconChecklist,
  IconHistory,
  IconPigMoney,
  IconRepeat,
  IconTemplate,
} from '@tabler/icons-react';

export interface NavLink {
  label: string;
  to: string;
  icon: React.ReactNode;
  'aria-label'?: string;
}

export interface NavGroup {
  label: string;
  icon: React.ReactNode;
  links: NavLink[];
}

/** Top-level links — always visible, not inside any group */
export const pinnedLinks: NavLink[] = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} />, 'aria-label': 'Go to dashboard' },
  { label: 'My Groups', to: '/groups', icon: <IconHome2 size={20} />, 'aria-label': 'View all groups' },
];

/** Collapsible nav groups — each has an icon for the category header */
export const navGroups: NavGroup[] = [
  {
    label: 'Money',
    icon: <IconCoin size={14} />,
    links: [
      { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} />, 'aria-label': 'View expenses' },
      { label: 'Recurring', to: '/recurring', icon: <IconRepeat size={20} />, 'aria-label': 'Manage recurring expenses' },
      { label: 'Templates', to: '/templates', icon: <IconTemplate size={20} />, 'aria-label': 'Manage split templates' },
      { label: 'Funds', to: '/funds', icon: <IconPigMoney size={20} />, 'aria-label': 'Manage shared funds' },
    ],
  },
  {
    label: 'Insights',
    icon: <IconChartPie size={14} />,
    links: [
      { label: 'Command Centre', to: '/overview', icon: <IconArrowsExchange size={20} />, 'aria-label': 'Cross-group overview' },
      { label: 'Breakdown', to: '/breakdown', icon: <IconFileText size={20} />, 'aria-label': 'View settlement breakdown' },
      { label: 'Analytics', to: '/analytics', icon: <IconChartBar size={20} />, 'aria-label': 'View spending analytics' },
    ],
  },
  {
    label: 'Team',
    icon: <IconUsers size={14} />,
    links: [
      { label: 'Members', to: '/members', icon: <IconUsers size={20} />, 'aria-label': 'View group members' },
      { label: 'Operations', to: '/chores', icon: <IconChecklist size={20} />, 'aria-label': 'Manage shared operations' },
      { label: 'Activity', to: '/activity', icon: <IconHistory size={20} />, 'aria-label': 'View activity log' },
    ],
  },
];

/** Flat list of all links (for collapsed sidebar / tooltips) */
export const navLinks: NavLink[] = [
  ...pinnedLinks,
  ...navGroups.flatMap((g) => g.links),
];
