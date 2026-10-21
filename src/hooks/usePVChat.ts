import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';

export const usePVChat = () => {
  const { notifications = [], addNotification, markNotificationAsRead } = useProject();

  const chatMessages = useMemo(() => {
    return (notifications || []).filter(n => n && (n.type === 'chat' || n.type === 'pv_message' || n.type === 'task_assigned'));
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(n => n && !n.read).length;
  }, [notifications]);

  const sendPVMessage = (title: string, description: string) => {
    if (addNotification) {
      addNotification({
        title,
        description,
        type: 'pv_message',
        read: false,
        timestamp: 'هم‌اکنون'
      });
    }
  };

  return {
    chatMessages,
    unreadCount,
    sendPVMessage,
    markNotificationAsRead
  };
};
