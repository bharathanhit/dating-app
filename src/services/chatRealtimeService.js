// src/services/chatRealtimeService.js
// Chat service using Firebase Realtime Database for messages

import { ref, push, onChildAdded, off } from 'firebase/database';
import { realtimeDb } from '../config/firebase'; // Use shared instance

// Send a chat message to a conversation
export const sendMessageRealtime = async (conversationId, messageObj) => {
  const messagesRef = ref(realtimeDb, `conversations/${conversationId}/messages`);
  await push(messagesRef, {
    ...messageObj,
    createdAt: Date.now(),
  });
};

// Listen for new messages in a conversation (returns unsubscribe function)
export const listenForMessagesRealtime = (conversationId, callback) => {
  const messagesRef = ref(realtimeDb, `conversations/${conversationId}/messages`);
  const handler = onChildAdded(messagesRef, (snapshot) => {
    callback({ id: snapshot.key, ...snapshot.val() });
  });
  // Return unsubscribe function
  return () => off(messagesRef, 'child_added', handler);
};

// Example messageObj: { senderId, text, ... }
