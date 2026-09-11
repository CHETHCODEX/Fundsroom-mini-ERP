import React from 'react';

interface BadgeProps {
  status: string;
  type?: 'status' | 'role' | 'customer_type' | 'category' | 'movement';
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const normalized = status.toLowerCase();

  let className = 'badge badge-neutral';

  if (['active', 'confirmed', 'in'].includes(normalized)) {
    className = 'badge badge-success';
  } else if (['lead', 'draft', 'pending'].includes(normalized)) {
    className = 'badge badge-warning';
  } else if (['inactive', 'cancelled', 'out', 'low stock'].includes(normalized)) {
    className = 'badge badge-danger';
  } else if (['admin', 'wholesale', 'distributor', 'electrical', 'power tools'].includes(normalized)) {
    className = 'badge badge-info';
  }

  return <span className={className}>{status}</span>;
};

export default Badge;
