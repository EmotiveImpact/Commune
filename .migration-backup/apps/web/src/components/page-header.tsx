import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="commune-page-header">
      <div>
        <div className="commune-page-header-title">{title}</div>
        <div className="commune-page-header-subtitle">{subtitle}</div>
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}
