import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

/**
 * Custom hook to listen to a user's online status
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

    const statusRef = ref(realtimeDb, `status/${userId}`);
    const unsubscribe = onValue(statusRef, (snap) => {
      setStatus(snap.val());
    });

    return () => unsubscribe();
  }, [userId]);

  return status;
};

/**
 * Custom hook to listen to multiple users' online statuses
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

      const statusRef = ref(realtimeDb, `status/${userId}`);
      const unsubscribe = onValue(statusRef, (snap) => {
        const status = snap.val();
        setStatuses((prev) => ({
          ...prev,
          [userId]: status,
        }));
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [JSON.stringify(userIds)]); // Use JSON.stringify for array comparison

  return statuses;
};

/**
 * Custom hook to set current user's online status
 * @param {string} userId - Current user's ID
 */
export const useSetOnlineStatus = (userId) => {
  useEffect(() => {
    if (!userId) return;

    const myStatusRef = ref(realtimeDb, `status/${userId}`);

    // Set online
    import('firebase/database').then(({ set, serverTimestamp, update }) => {
      set(myStatusRef, {
        online: true,
        lastSeen: serverTimestamp(),
      });

      // Handle offline on tab close
      const handleOffline = () => {
        update(myStatusRef, {
          online: false,
          lastSeen: serverTimestamp(),
        });
      };

      window.addEventListener('beforeunload', handleOffline);

      return () => {
        handleOffline();
        window.removeEventListener('beforeunload', handleOffline);
      };
    });
  }, [userId]);
};
