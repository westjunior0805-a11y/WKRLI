import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  hidden?: boolean;
  dividerBefore?: boolean;
}

interface RowActionsMenuProps {
  actions: RowActionItem[];
  buttonLabel?: string;
  buttonTitle?: string;
}

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  actions,
  buttonLabel,
  buttonTitle = 'Options & Actions',
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const visibleActions = actions.filter((a) => !a.hidden);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const estimatedHeight = Math.min(340, visibleActions.length * 38 + 16);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

      const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
      const top = openUp ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4;
      setMenuPos({ top, left, openUp });
    };

    updatePosition();

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleScrollOrResize = () => setOpen(false);

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, visibleActions.length]);

  if (visibleActions.length === 0) return null;

  const toneClass = (tone?: RowActionItem['tone']) => {
    switch (tone) {
      case 'primary':
        return 'text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/60';
      case 'success':
        return 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/60';
      case 'warning':
        return 'text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/60';
      case 'danger':
        return 'text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/60';
      default:
        return 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title={buttonTitle}
        className={`inline-flex items-center justify-center gap-1 rounded-lg border transition-colors cursor-pointer ${
          buttonLabel ? 'px-2 py-1 text-[11px] font-semibold' : 'p-1.5'
        } ${
          open
            ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        <MoreVertical className="w-3.5 h-3.5 shrink-0" />
        {buttonLabel && <span>{buttonLabel}</span>}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: '220px',
              zIndex: 9999,
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 text-xs"
          >
            {visibleActions.map((action, idx) => (
              <React.Fragment key={idx}>
                {action.dividerBefore && idx > 0 && (
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                )}
                <button
                  type="button"
                  disabled={action.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    action.onClick();
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${toneClass(
                    action.tone
                  )}`}
                >
                  {action.icon && <span className="shrink-0">{action.icon}</span>}
                  <span className="truncate">{action.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};
