import { db } from '../config/firebase.js';
import app from '../config/firebase.js';
import { getMessaging, isSupported, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

let messaging = null;

const getMessagingInstance = async () => {
  if (messaging) return messaging;
  try {
    const supported = await isSupported();
    if (supported) {
      // Register service worker explicitly for better reliability
      if ('serviceWorker' in navigator) {
        try {
          console.log('[NotificationService] Registering service worker...');
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
          });
          console.log('[NotificationService] Service Worker registered with scope:', registration.scope);
          
          // Wait for the service worker to be ready
          await navigator.serviceWorker.ready;
          console.log('[NotificationService] Service Worker is ready.');
          
          messaging = getMessaging(app);
          return messaging;
        } catch (err) {
          console.error('[NotificationService] Service Worker registration failed:', err);
        }
      } else {
        console.warn('[NotificationService] Service workers are not supported in this browser.');
      }
    } else {
      console.warn('[NotificationService] FCM is not supported in this browser.');
    }
  } catch (err) {
    console.error('[NotificationService] Error checking messaging support:', err);
  }
  return null;
};

export const requestNotificationPermission = async (userId) => {
  console.log('[NotificationService] Requesting permission for user:', userId);
  
  if (!('Notification' in window)) {
    console.warn('[NotificationService] This browser does not support desktop notifications');
    return null;
  }

  try {
    let permission = Notification.permission;
    console.log('[NotificationService] Current permission status:', permission);

    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      console.log('[NotificationService] Permission granted.');
      
      const messagingInstance = await getMessagingInstance();
      if (!messagingInstance) {
        console.warn('[NotificationService] FCM Messaging is not supported or failed to initialize.');
        return null;
      }

      // Get FCM token
      console.log('[NotificationService] Fetching FCM token...');
      const token = await getToken(messagingInstance, {
        vapidKey: 'BJ4pJtfJ_UetAzYn_530-Q5g42iHBmEliY48dIv_ZCx4rDJhpMu8MZaLddUThmdMbbpc5MIOh27-6gXHhaQ3OVo'
      });

      if (token) {
        console.log('[NotificationService] FCM Token retrieved successfully:', token);
        // Store token in user's document
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token)
        });
        console.log('[NotificationService] Token saved to Firestore.');
        return token;
      } else {
        console.warn('[NotificationService] No registration token available. Request permission to generate one.');
      }
    } else {
      console.warn('[NotificationService] Notification permission was denied or dismissed:', permission);
    }
  } catch (error) {
    console.error('[NotificationService] An error occurred while retrieving token.', error);
  }
  return null;
};

export const onMessageListener = async (callback) => {
  const messagingInstance = await getMessagingInstance();
  if (!messagingInstance) return null;

  return onMessage(messagingInstance, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};
