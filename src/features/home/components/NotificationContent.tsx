import { Bell, CheckCircle } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'quiz' | 'system';
}

// Mock notifications - replace with actual data from API
const mockNotifications: NotificationItem[] = [
  {
    id: '1',
    title: 'Quiz Completed',
    message: 'You completed "JavaScript Basics" with 90% score!',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
    type: 'success',
  },
  {
    id: '2',
    title: 'New Quiz Available',
    message: 'Check out the new "React Hooks" quiz created by the community.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
    type: 'quiz',
  },
  {
    id: '3',
    title: 'Weekly Challenge',
    message: 'This week\'s challenge: "TypeScript Fundamentals". Earn bonus points!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
    type: 'info',
  },
  {
    id: '4',
    title: 'Achievement Unlocked',
    message: 'You earned the "Quiz Master" badge for completing 50 quizzes!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    read: true,
    type: 'success',
  },
];

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type: NotificationItem['type']) {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />;
    case 'warning':
      return <span className="w-5 h-5 text-yellow-500">⚠</span>;
    case 'quiz':
      return <Bell className="w-5 h-5 text-primary-500" aria-hidden="true" />;
    case 'system':
      return <span className="w-5 h-5 text-gray-500">⚙</span>;
    default:
      return <Bell className="w-5 h-5 text-blue-500" aria-hidden="true" />;
  }
}

export function NotificationContent() {
  return (
    <div className="p-4 space-y-3">
      {mockNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" aria-hidden="true" />
          <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            You'll see updates here when you have new activity
          </p>
        </div>
      ) : (
        <ul className="space-y-2" role="list" aria-label="Notifications">
          {mockNotifications.map((notification) => (
            <li
              key={notification.id}
              className={`flex gap-3 p-3 rounded-xl transition-colors ${
                !notification.read
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30'
                  : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-medium text-sm ${!notification.read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    {notification.title}
                  </p>
                  {!notification.read && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500" aria-label="Unread" />
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {notification.message}
                </p>
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {formatTimeAgo(notification.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {mockNotifications.filter(n => !n.read).length} unread notification{mockNotifications.filter(n => !n.read).length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}