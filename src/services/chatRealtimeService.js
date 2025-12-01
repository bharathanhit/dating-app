// src/services/chatRealtimeService.js
// Chat service using Firebase Realtime Database for messages

import { ref, push, onChildAdded, off, set, onValue, update, serverTimestamp } from 'firebase/database';
import { realtimeDb } from '../config/firebase'; // Use shared instance

// Send a chat message to a conversation
export const sendMessageRealtime = async (conversationId, messageObj) => {
  const messagesRef = ref(realtimeDb, `conversations/${conversationId}/messages`);
  const newMsgRef = await push(messagesRef, {
    ...messageObj,
    createdAt: Date.now(),
    read: false,
    delivered: true,
  });
  
  // Update last message in conversation
  const lastMsgRef = ref(realtimeDb, `conversations/${conversationId}/lastMessage`);
  await set(lastMsgRef, {
    text: messageObj.text,
    senderId: messageObj.senderId,
    timestamp: Date.now(),
  });
  
  return newMsgRef.key;
};

// Listen for messages in a conversation (returns unsubscribe function)
// This loads all existing messages and listens for new ones
export const listenForMessagesRealtime = (conversationId, callback) => {
  const messagesRef = ref(realtimeDb, `conversations/${conversationId}/messages`);
  const messages = [];

  const childHandler = onChildAdded(messagesRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    const msg = { id: snapshot.key, ...data };
    messages.push(msg);
    // Sort messages by createdAt/timestamp to keep order
    messages.sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)));
    callback([...messages]);
  });

  // Return unsubscribe that detaches the listener
  return () => {
    off(messagesRef, 'child_added', childHandler);
  };
};

// ==================== TYPING INDICATORS ====================

// Set typing status for a user in a conversation
export const setTypingStatus = async (conversationId, userId, isTyping) => {
  if (!conversationId || !userId) return;
  
  const typingRef = ref(realtimeDb, `typing/${conversationId}/${userId}`);
  await set(typingRef, isTyping ? Date.now() : null);
};

// Listen for typing status of other user in a conversation
export const listenForTyping = (conversationId, otherUserId, callback) => {
  if (!conversationId || !otherUserId) return () => {};
  
  const typingRef = ref(realtimeDb, `typing/${conversationId}/${otherUserId}`);
  const unsub = onValue(typingRef, (snapshot) => {
    const timestamp = snapshot.val();
    // Consider typing if timestamp exists and is less than 5 seconds old
    const isTyping = timestamp && (Date.now() - timestamp < 5000);
    callback(isTyping);
  });
  
  return unsub;
};

// ==================== READ RECEIPTS ====================

// Mark messages as read
export const markMessagesAsRead = async (conversationId, messageIds, userId) => {
  if (!conversationId || !messageIds?.length) return;
  
  const updates = {};
  messageIds.forEach(msgId => {
    updates[`conversations/${conversationId}/messages/${msgId}/read`] = true;
    updates[`conversations/${conversationId}/messages/${msgId}/readBy/${userId}`] = Date.now();
  });
  
  await update(ref(realtimeDb), updates);
};

// Mark a single message as read
export const markMessageAsRead = async (conversationId, messageId, userId) => {
  if (!conversationId || !messageId) return;
  
  const msgRef = ref(realtimeDb, `conversations/${conversationId}/messages/${messageId}`);
  await update(msgRef, {
    read: true,
    readAt: Date.now(),
    readBy: userId,
  });
};

// ==================== ONLINE STATUS ====================

// Update user online status
export const updateOnlineStatus = async (userId, isOnline) => {
  if (!userId) return;
  
  const statusRef = ref(realtimeDb, `status/${userId}`);
  await set(statusRef, {
    online: isOnline,
    lastSeen: isOnline ? null : Date.now(),
    updatedAt: Date.now(),
  });
};

// Listen for user online status
export const listenForOnlineStatus = (userId, callback) => {
  if (!userId) return () => {};
  
  const statusRef = ref(realtimeDb, `status/${userId}`);
  const unsub = onValue(statusRef, (snapshot) => {
    callback(snapshot.val());
  });
  
  return unsub;
};

// Set user as online and handle disconnect
export const setUserOnline = async (userId) => {
  if (!userId) return;
  
  const statusRef = ref(realtimeDb, `status/${userId}`);
  
  // Set online
  await set(statusRef, {
    online: true,
    lastSeen: null,
    updatedAt: Date.now(),
  });
  
  // Note: onDisconnect requires special setup, handle in component
};

// Set user as offline
export const setUserOffline = async (userId) => {
  if (!userId) return;
  
  const statusRef = ref(realtimeDb, `status/${userId}`);
  await set(statusRef, {
    online: false,
    lastSeen: Date.now(),
    updatedAt: Date.now(),
  });
};

// Example messageObj: { senderId, text, ... }
