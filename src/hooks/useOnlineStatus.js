import { useState, useEffect } from 'react';
import { listenForUserStatus, setUserOnline, setUserOffline } from '../services/chatServiceV2';

/**
 * Custom hook to listen to a user's online status (Firestore version)
 * @param {string} userId - The user ID to monitor
 * @returns {Object} - { online: boolean, lastSeen: timestamp }
 */
export const useOnlineStatus = (userId) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }

    const unsub = listenForUserStatus(userId, (newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [userId]);

  return status;
};

/**
 * Custom hook to listen to multiple users' online statuses (Firestore version)
 * @param {string[]} userIds - Array of user IDs to monitor
 * @returns {Object} - Object mapping userId to { online: boolean, lastSeen: timestamp }
 */
export const useMultipleOnlineStatuses = (userIds) => {
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      setStatuses({});
      return;
    }

    const unsubscribers = [];

    userIds.forEach((userId) => {
      if (!userId) return;

      const unsubscribe = listenForUserStatus(userId, (status) => {
        setStatuses((prev) => ({
          ...prev,
          [userId]: status,
        }));
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [JSON.stringify(userIds)]); // Use JSON.stringify for array comparison

  return statuses;
};

/**
 * Custom hook to set current user's online status (Firestore version)
 * @param {string} userId - Current user's ID
 */
export const useSetOnlineStatus = (userId) => {
  useEffect(() => {
    if (!userId) return;

    // Set online
    setUserOnline(userId);

    const handleBeforeUnload = () => {
      setUserOffline(userId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setUserOnline(userId);
      } else {
        setUserOffline(userId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      setUserOffline(userId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
};

