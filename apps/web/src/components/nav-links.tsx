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

export const navLinks = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} /> },
  { label: 'Overview', to: '/overview', icon: <IconArrowsExchange size={20} /> },
  { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} /> },
  { label: 'Recurring', to: '/recurring', icon: <IconRepeat size={20} /> },
  { label: 'Templates', to: '/templates', icon: <IconTemplate size={20} /> },
  { label: 'Funds', to: '/funds', icon: <IconPigMoney size={20} /> },
  { label: 'My Breakdown', to: '/breakdown', icon: <IconFileText size={20} /> },
  { label: 'Members', to: '/members', icon: <IconUsers size={20} /> },
  { label: 'Analytics', to: '/analytics', icon: <IconChartBar size={20} /> },
  { label: 'Activity', to: '/activity', icon: <IconHistory size={20} /> },
];
