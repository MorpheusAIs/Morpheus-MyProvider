'use client';

import { useNotification } from '@/lib/NotificationContext';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * NotificationManager displays toast notifications
 * Renders at the top-right of the screen
 */
export default function NotificationManager() {
  const { notifications, dismissNotification } = useNotification();

  if (notifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />;
      default:
        return null;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/80 border-green-700';
      case 'error':
        return 'bg-red-900/80 border-red-700';
      case 'warning':
        return 'bg-yellow-900/80 border-yellow-700';
      case 'info':
        return 'bg-blue-900/80 border-blue-700';
      default:
        return 'bg-gray-800/80 border-gray-700';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${getBgColor(
            notification.type
          )}`}
        >
          <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white">{notification.title}</h4>
            <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => dismissNotification(notification.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

