import {
  IconChartBar,
  IconDashboard,
  IconReceipt,
  IconFileText,
  IconUsers,
  IconCreditCard,
  IconHistory,
  IconRepeat,
  IconSettings,
} from '@tabler/icons-react';

export const navLinks = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} /> },
  { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} /> },
  { label: 'Recurring', to: '/recurring', icon: <IconRepeat size={20} /> },
  { label: 'My Breakdown', to: '/breakdown', icon: <IconFileText size={20} /> },
  { label: 'Members', to: '/members', icon: <IconUsers size={20} /> },
  { label: 'Analytics', to: '/analytics', icon: <IconChartBar size={20} /> },
  { label: 'Activity', to: '/activity', icon: <IconHistory size={20} /> },
  { label: 'Pricing', to: '/pricing', icon: <IconCreditCard size={20} /> },
  { label: 'Settings', to: '/settings', icon: <IconSettings size={20} /> },
];
