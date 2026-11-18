import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0">
      {toasts.map((toast) => {
        let borderClass = 'border-slate-200';
        let bgIconClass = 'text-slate-600';
        let Icon = Info;

        if (toast.type === 'success') {
          borderClass = 'border-emerald-200 bg-white shadow-lg';
          bgIconClass = 'text-emerald-600';
          Icon = CheckCircle2;
        } else if (toast.type === 'error') {
          borderClass = 'border-rose-200 bg-white shadow-lg';
          bgIconClass = 'text-rose-600';
          Icon = AlertCircle;
        } else {
          borderClass = 'border-sky-200 bg-white shadow-lg';
          bgIconClass = 'text-sky-600';
          Icon = Info;
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg border ${borderClass} shadow-md transition-all duration-200`}
            role="alert"
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${bgIconClass}`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-900">{toast.title}</h4>
              {toast.message && <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              aria-label="Fermer la notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
