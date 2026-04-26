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
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('Service Worker registered with scope:', registration.scope);
        } catch (err) {
          console.error('Service Worker registration failed:', err);
        }
      }
      messaging = getMessaging(app);
      return messaging;
    }
  } catch (err) {
    console.error('Error checking messaging support:', err);
  }
  return null;
};

export const requestNotificationPermission = async (userId) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      const messagingInstance = await getMessagingInstance();
      if (!messagingInstance) {
        console.warn('FCM Messaging is not supported in this browser.');
        return null;
      }

      // Get FCM token
      const token = await getToken(messagingInstance, {
        vapidKey: 'BJ4pJtfJ_UetAzYn_530-Q5g42iHBmEliY48dIv_ZCx4rDJhpMu8MZaLddUThmdMbbpc5MIOh27-6gXHhaQ3OVo'
      });


      if (token) {
        console.log('FCM Token:', token);
        // Store token in user's document
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token)
        });
        return token;
      } else {
        console.warn('No registration token available. Request permission to generate one.');
      }
    } else {
      console.warn('Unable to get permission to notify.');
    }
  } catch (error) {
    console.error('An error occurred while retrieving token.', error);
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
