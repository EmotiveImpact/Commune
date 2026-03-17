import {
  IconDashboard,
  IconReceipt,
  IconFileText,
  IconUsers,
  IconSettings,
} from '@tabler/icons-react';

export const navLinks = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard size={20} /> },
  { label: 'Expenses', to: '/expenses', icon: <IconReceipt size={20} /> },
  { label: 'My Breakdown', to: '/breakdown', icon: <IconFileText size={20} /> },
  { label: 'Members', to: '/members', icon: <IconUsers size={20} /> },
  { label: 'Settings', to: '/settings', icon: <IconSettings size={20} /> },
];
