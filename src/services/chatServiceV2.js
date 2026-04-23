import { db } from '../config/firebase.js';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  getDocs, 
  updateDoc,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';

// Deterministic conversation id for two users (sorted uids)
const conversationIdFor = (uidA, uidB) => {
  const [a, b] = [uidA, uidB].sort();
  return `conv_${a}_${b}`;
};

export const getOrCreateConversation = async (uidA, uidB) => {
  const convId = conversationIdFor(uidA, uidB);
  const convRef = doc(db, 'conversations', convId);
  
  try {
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      console.log('[Chat] Conversation exists:', convId);
      return { id: convId, ...convSnap.data() };
    }

    // Create new conversation
    const convData = {
      id: convId,
      participants: [uidA, uidB],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
    };
    
    await setDoc(convRef, convData);
    console.log('[Chat] New conversation created:', convId);
    return { id: convId, ...convData };
  } catch (err) {
    console.error('[Chat] getOrCreateConversation error:', err.code, err.message);
    throw new Error(`Failed to get/create conversation: ${err.message}`);
  }
};

export const sendMessage = async (conversationId, messageObj) => {
  const { senderId, text, type = 'text' } = messageObj;
  console.log('[Chat] sendMessage:', { conversationId, senderId, textLength: text?.length });
  
  if (!conversationId) throw new Error('conversationId required');
  if (!senderId) throw new Error('senderId required');
  if (!text?.trim() && type !== 'audio') throw new Error('text required');

  try {
    // Step 1: Check block status
    console.log('[Chat] Step 1: Fetching conversation doc for block check...', conversationId);
    const convDocRef = doc(db, 'conversations', conversationId);
    const convDocSnap = await getDoc(convDocRef);
    
    if (!convDocSnap.exists()) {
      console.error('[Chat] Conversation doc does not exist:', conversationId);
      throw new Error('Conversation not found');
    }
    
    const convData = convDocSnap.data();
    const participants = convData.participants || [];
    const recipientId = participants.find(id => id !== senderId);
    
    console.log('[Chat] Participants:', participants, 'Sender:', senderId, 'Recipient:', recipientId);

    if (recipientId) {
      try {
        console.log('[Chat] Checking if sender is blocked by recipient...');
        const blockedByRecipientRef = doc(collection(db, 'users', recipientId, 'blockedUsers'), senderId);
        const blockedByRecipientSnap = await getDoc(blockedByRecipientRef);
        if (blockedByRecipientSnap.exists()) {
          console.warn('[Chat] Sender is blocked by recipient');
          throw new Error('You cannot send messages to this user. They have blocked you.');
        }
        
        console.log('[Chat] Checking if sender has blocked recipient...');
        const senderBlockedRecipientRef = doc(collection(db, 'users', senderId, 'blockedUsers'), recipientId);
        const senderBlockedRecipientSnap = await getDoc(senderBlockedRecipientRef);
        if (senderBlockedRecipientSnap.exists()) {
          console.warn('[Chat] Sender has blocked recipient');
          throw new Error('You cannot send messages to a user you have blocked. Unblock them first.');
        }
      } catch (blockErr) {
        // If it's a permission error, we simply can't check. Proceed and let server rules decide on write.
        // If it is the "You cannot send..." error we just threw, re-throw it.
        if (blockErr.message.includes('You cannot send messages')) {
          throw blockErr;
        }
        console.warn('[Chat] Block check failed (likely permission), proceeding optimistically:', blockErr.message);
      }
    } else {
      console.warn('[Chat] No recipient found in conversation participants');
    }

    // Step 2: Add message to subcollection
    console.log('[Chat] Step 2: Adding message to subcollection...');
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const msgDoc = {
      ...messageObj,
      from: senderId,
      createdAt: serverTimestamp(),
      read: false,
    };
    
    const docRef = await addDoc(messagesRef, msgDoc);
    console.log('[Chat] Message doc added with ID:', docRef.id);
    
    // Step 3: Update conversation with last message
    console.log('[Chat] Step 3: Updating conversation lastMessage...');
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(convRef, {
      lastMessage: {
        text: type === 'audio' ? '🎤 Audio Message' : text.trim(),
        from: senderId,
        senderId: senderId,
        sentAt: serverTimestamp(),
        timestamp: Date.now(),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log('[Chat] sendMessage completed successfully');
    return docRef.id;
  } catch (err) {
    console.error('[Chat] sendMessage failed at some point:', err);
    throw err;
  }
};

export const listenForConversations = (userUid, onUpdate) => {
  if (!userUid) return () => {};

  try {
    console.log('[Chat] Setting up conversation listener for user:', userUid);
    const convsRef = collection(db, 'conversations');
    // TEMPORARY DEBUG: Removed orderBy to bypass index requirement
    // const q = query(convsRef, where('participants', 'array-contains', userUid), orderBy('updatedAt', 'desc'));
    const q = query(convsRef, where('participants', 'array-contains', userUid));
    
    return onSnapshot(q, (snap) => {
      console.log('[Chat] Conversation snapshot received. Docs count:', snap.docs.length);
      const list = snap.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        console.log('[Chat] Conversation:', doc.id, 'participants:', data.participants, 'lastMessage:', data.lastMessage);
        return data;
      });
      
      // Manual sort since we removed orderBy
      list.sort((a, b) => {
        const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
        const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
        return tB - tA;
      });

      console.log('[Chat] Calling onUpdate with', list.length, 'conversations');
      onUpdate(list);
    }, (err) => {
      console.error('[Chat] listenForConversations error:', err);
      console.error('[Chat] Error code:', err.code);
      console.error('[Chat] Error message:', err.message);
      if (err.code === 'failed-precondition' || err.message?.includes('index')) {
        console.error('[Chat] ⚠️ FIRESTORE INDEX REQUIRED! Check the error message for the index creation link.');
      }
      onUpdate([]);
    });
  } catch (err) {
    console.error('[Chat] listenForConversations setup error:', err);
    return () => {};
  }
};

export const listenForMessages = (conversationId, onUpdate) => {
  if (!conversationId) return () => {};

  try {
    const msgsRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(list);
    }, (err) => {
      console.error('[Chat] listenForMessages error:', err);
      onUpdate([]);
    });
  } catch (err) {
    console.error('[Chat] listenForMessages setup error:', err);
    return () => {};
  }
};

// ==================== ONLINE STATUS (Firestore) ====================

export const setUserOnline = async (userId) => {
  if (!userId) return;
  console.log('[Chat] Setting user online:', userId);
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, {
      status: {
        online: true,
        lastSeen: null,
        updatedAt: serverTimestamp()
      }
    }, { merge: true });
    console.log('[Chat] User online status set successfully');
  } catch (err) {
    console.warn('[Chat] Failed to set user online in Firestore:', err.message);
  }
};

export const setUserOffline = async (userId) => {
  if (!userId) return;
  console.log('[Chat] Setting user offline:', userId);
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, {
      status: {
        online: false,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
      }
    }, { merge: true });
    console.log('[Chat] User offline status set successfully');
  } catch (err) {
    console.warn('[Chat] Failed to set user offline in Firestore:', err.message);
  }
};

export const listenForUserStatus = (userId, callback) => {
  if (!userId) {
    callback(null);
    return () => {};
  }
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(data.status || { online: false, lastSeen: null });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('[Chat] Error listening for user status:', err);
    callback(null);
  });
};

export const listenForAllOnlineUsers = (callback) => {
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('status.online', '==', true));
    
    return onSnapshot(q, (snapshot) => {
      const onlineMap = {};
      snapshot.docs.forEach(doc => {
        onlineMap[doc.id] = true;
      });
      console.log('[Chat] Online users updated (all):', Object.keys(onlineMap).length);
      callback(onlineMap);
    }, (err) => {
      console.error('[Chat] Error listening for all online users:', err);
      callback({});
    });
  } catch (err) {
    console.error('[Chat] Failed to setup all online users listener:', err);
    return () => {};
  }
};

// ==================== TYPING INDICATORS (Firestore) ====================

export const setTypingStatus = async (conversationId, userId, isTyping) => {
  if (!conversationId || !userId) return;
  const convRef = doc(db, 'conversations', conversationId);
  try {
    await updateDoc(convRef, {
      [`typing.${userId}`]: isTyping ? Date.now() : null
    });
  } catch (err) {
    console.error('[Chat] Failed to update typing status:', err);
  }
};

export const listenForTyping = (conversationId, otherUserId, callback) => {
  if (!conversationId || !otherUserId) return () => {};
  const convRef = doc(db, 'conversations', conversationId);
  return onSnapshot(convRef, (docSnap) => {
    if (docSnap.exists()) {
      const typing = docSnap.data().typing || {};
      const timestamp = typing[otherUserId];
      const isTyping = timestamp && (Date.now() - timestamp < 5000);
      callback(isTyping);
    } else {
      callback(false);
    }
  });
};

// ==================== READ RECEIPTS (Firestore) ====================

export const markMessagesAsRead = async (conversationId, messageIds, userId) => {
  if (!conversationId || !messageIds?.length) return;
  
  try {
    const batch = writeBatch(db);
    messageIds.forEach(msgId => {
      const msgRef = doc(db, 'conversations', conversationId, 'messages', msgId);
      batch.update(msgRef, {
        read: true,
        [`readBy.${userId}`]: Date.now()
      });
    });
    await batch.commit();
  } catch (err) {
    console.error('[Chat] Failed to mark messages as read:', err);
  }
};

// ==================== AUDIO MESSAGES (Firestore) ====================

export const updateMessageAudioStatus = async (conversationId, messageId, status, userId) => {
  if (!conversationId || !messageId) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  try {
    const updates = { audioStatus: status };
    if (status === 'accepted' || status === 'denied') {
      updates[`${status}By`] = userId;
      updates[`${status}At`] = Date.now();
    }
    await updateDoc(msgRef, updates);
  } catch (err) {
    console.error('[Chat] Failed to update audio status:', err);
  }
};

export const setAudioTrust = async (conversationId, senderId) => {
  if (!conversationId || !senderId) return;
  const convRef = doc(db, 'conversations', conversationId);
  try {
    await updateDoc(convRef, {
      [`settings.audioTrusted.${senderId}`]: true
    });
  } catch (err) {
    console.error('[Chat] Failed to set audio trust:', err);
  }
};

export const checkAudioTrust = async (conversationId, senderId) => {
  if (!conversationId || !senderId) return false;
  const convRef = doc(db, 'conversations', conversationId);
  try {
    const snap = await getDoc(convRef);
    if (snap.exists()) {
      const settings = snap.data().settings || {};
      const trusted = settings.audioTrusted || {};
      return trusted[senderId] === true;
    }
    return false;
  } catch (err) {
    console.error('[Chat] Failed to check audio trust:', err);
    return false;
  }
};

export const fetchOldConversations = async (userUid) => {
  if (!userUid) return [];
  try {
    const convsRef = collection(db, 'conversations');
    const q = query(convsRef, where('participants', 'array-contains', userUid), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('[Chat] fetchOldConversations error:', err.message);
    return [];
  }
};
export const deleteMessage = async (conversationId, messageId) => {
  if (!conversationId || !messageId) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  try {
    await deleteDoc(msgRef);
    console.log('[Chat] Message deleted:', messageId);
  } catch (err) {
    console.error('[Chat] Failed to delete message:', err);
    throw err;
  }
};
