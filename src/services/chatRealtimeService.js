// src/services/chatRealtimeService.js
// Chat service using Firebase Realtime Database for messages

import { ref, push, onChildAdded, off, set, onValue, update, serverTimestamp, onDisconnect, get } from 'firebase/database';
import { realtimeDb } from '../config/firebase'; // Use shared instance
import { db } from '../config/firebase'; // Firestore for block checking
import { doc, getDoc, collection } from 'firebase/firestore';

// Send a chat message to a conversation
export const sendMessageRealtime = async (conversationId, messageObj) => {
  console.log('[ChatRealtime] Sending message to conversation:', conversationId, messageObj);
  
  // Step 1: Get conversation participants from Firestore (not Realtime DB)
  try {
    const convDocRef = doc(db, 'conversations', conversationId);
    const convDocSnap = await getDoc(convDocRef);
    
    if (!convDocSnap.exists()) {
      console.error('[ChatRealtime] Conversation not found in Firestore');
      throw new Error('Conversation not found');
    }
    
    const convData = convDocSnap.data();
    const participants = convData.participants;
    
    if (!participants || participants.length < 2) {
      console.error('[ChatRealtime] Invalid participants');
      throw new Error('Invalid conversation participants');
    }
    
    const recipientId = participants.find(id => id !== messageObj.senderId);
    
    if (!recipientId) {
      console.error('[ChatRealtime] Could not find recipient');
      throw new Error('Recipient not found');
    }
    
    console.log('[ChatRealtime] Checking block status between', messageObj.senderId, 'and', recipientId);
    
    // Step 2: Check if sender is blocked by recipient
    const blockedByRecipientRef = doc(collection(db, 'users', recipientId, 'blockedUsers'), messageObj.senderId);
    const blockedByRecipientSnap = await getDoc(blockedByRecipientRef);
    
    if (blockedByRecipientSnap.exists()) {
      console.warn('[ChatRealtime] ❌ Message blocked: Sender is blocked by recipient');
      throw new Error('You cannot send messages to this user. They have blocked you.');
    }
    
    // Step 3: Check if sender has blocked recipient
    const senderBlockedRecipientRef = doc(collection(db, 'users', messageObj.senderId, 'blockedUsers'), recipientId);
    const senderBlockedRecipientSnap = await getDoc(senderBlockedRecipientRef);
    
    if (senderBlockedRecipientSnap.exists()) {
      console.warn('[ChatRealtime] ❌ Message blocked: Sender has blocked recipient');
      throw new Error('You cannot send messages to a user you have blocked. Unblock them first.');
    }
    
    console.log('[ChatRealtime] ✓ Block check passed, sending message');
  } catch (error) {
    // Re-throw block errors and conversation errors
    if (error.message.includes('blocked') || error.message.includes('Conversation') || error.message.includes('Recipient')) {
      throw error;
    }
    console.warn('[ChatRealtime] Could not check block status:', error);
    // Continue anyway if other errors occur
  }
  
  // Step 4: Send the message
  const messagesRef = ref(realtimeDb, `conversations/${conversationId}/messages`);
  const newMsgRef = await push(messagesRef, {
    ...messageObj,
    createdAt: Date.now(),
    read: false,
    delivered: true,
  });
  
  console.log('[ChatRealtime] Message sent with key:', newMsgRef.key);
  
  // Update last message in conversation
  const lastMsgRef = ref(realtimeDb, `conversations/${conversationId}/lastMessage`);
  await set(lastMsgRef, {
    text: messageObj.text,
    senderId: messageObj.senderId,
    timestamp: Date.now(),
  });
  
  console.log('[ChatRealtime] Last message updated');
  return newMsgRef.key;
};

// Listen for messages in a conversation (returns unsubscribe function)
// This loads all existing messages and listens for new ones
export const listenForMessagesRealtime = (conversationId, callback) => {
  console.log('[ChatRealtime] Setting up listener for conversation:', conversationId);
  const messagesRef = ref(realtimeDb, `conversations/${conversationId}/messages`);

  // Use onValue to get all messages at once instead of accumulating with onChildAdded
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    console.log('[ChatRealtime] Messages snapshot received for:', conversationId);
    
    if (!data) {
      console.log('[ChatRealtime] No messages found');
      callback([]);
      return;
    }

    // Convert messages object to array
    const messagesArray = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));

    // Sort messages by createdAt/timestamp to keep order
    messagesArray.sort((a, b) => (Number(a.createdAt || a.timestamp || 0) - Number(b.createdAt || b.timestamp || 0)));
    
    console.log('[ChatRealtime] Total messages:', messagesArray.length);
    callback(messagesArray);
  });

  // Return unsubscribe function
  return () => {
    console.log('[ChatRealtime] Unsubscribing from conversation:', conversationId);
    unsubscribe();
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
  
  // Handle disconnect automatically
  const onDisconnectRef = onDisconnect(statusRef);
  await onDisconnectRef.set({
    online: false,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
