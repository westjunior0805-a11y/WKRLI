import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { SupplierOrder } from '../../types';

interface OrderStatusBadgeProps {
  order: SupplierOrder;
  onNavigate?: (orderId: string) => void;
  compact?: boolean;
  className?: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  order,
  onNavigate,
  compact = false,
  className = '',
}) => {
  const isSentOrPartial =
    order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';
  const label = isSentOrPartial ? 'Commandé' : 'En commande';
  const title = `${label} — ${order.orderNumber}${
    order.supplierName ? ` (${order.supplierName})` : ''
  }${onNavigate ? ' — Cliquer pour ouvrir la liste de commande' : ''}`;

  const baseClasses = `inline-flex items-center gap-1 rounded font-mono font-bold uppercase tracking-wider border whitespace-nowrap shrink-0 transition-colors ${
    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
  } bg-[#FFF9DF] text-[#7A5C00] border-[#E5C130] ${
    onNavigate ? 'hover:bg-[#FFCD11] hover:text-[#111111] hover:border-[#111111] cursor-pointer' : ''
  } ${className}`;

  if (onNavigate) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(order.id);
        }}
        title={title}
        className={baseClasses}
      >
        <ShoppingBag className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
        <span>{label}</span>
        {!compact && <span className="text-[#111111] font-extrabold">· {order.orderNumber}</span>}
      </button>
    );
  }

  return (
    <span title={title} className={baseClasses}>
      <ShoppingBag className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      <span>{label}</span>
      {!compact && <span className="text-[#111111] font-extrabold">· {order.orderNumber}</span>}
    </span>
  );
};
