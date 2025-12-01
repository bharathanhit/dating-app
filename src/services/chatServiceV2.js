import { db } from '../config/firebase.js';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

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

export const sendMessage = async (conversationId, fromUid, text) => {
  console.log('[Chat] sendMessage:', { conversationId, fromUid, textLength: text?.length });
  
  if (!conversationId) throw new Error('conversationId required');
  if (!fromUid) throw new Error('fromUid required');
  if (!text?.trim()) throw new Error('text required');

  try {
    // Add message to subcollection
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const msgDoc = {
      from: fromUid,
      text: text.trim(),
      createdAt: serverTimestamp(),
      read: false,
    };
    
    const docRef = await addDoc(messagesRef, msgDoc);
    console.log('[Chat] Message sent:', docRef.id);
    
    // Update conversation with last message
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(convRef, {
      lastMessage: {
        text: text.trim(),
        from: fromUid,
        sentAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log('[Chat] Conversation updated');
    return docRef.id;
  } catch (err) {
    console.error('[Chat] sendMessage error:', err.code, err.message);
    throw new Error(`Failed to send message: ${err.message}`);
  }
};

export const listenForConversations = (userUid, onUpdate) => {
  console.log('[Chat] Listening for conversations for:', userUid);
  
  if (!userUid) {
    console.warn('[Chat] No userUid provided');
    return () => {};
  }

  try {
    const convsRef = collection(db, 'conversations');
    const q = query(convsRef, where('participants', 'array-contains', userUid));
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          console.log('[Chat] Conversation data:', data);
          if (data.participants?.includes(userUid)) {
            list.push({ id: docSnap.id, ...data });
          }
        });
        // Client-side sort to avoid index requirement
        list.sort((a, b) => {
          const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
          const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
          return tB - tA;
        });
        
        console.log('[Chat] Conversations update:', list.length, 'convs');
        onUpdate(list);
      },
      (err) => {
        console.error('[Chat] listenForConversations error:', err.code, err.message);
        onUpdate([]);
      }
    );
    
    return unsub;
  } catch (err) {
    console.error('[Chat] listenForConversations setup error:', err.message);
    return () => {};
  }
};

export const listenForMessages = (conversationId, onUpdate) => {
  console.log('[Chat] Listening for messages in:', conversationId);
  
  if (!conversationId) {
    console.warn('[Chat] No conversationId provided');
    return () => {};
  }

  try {
    const msgsRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        console.log('[Chat] Messages update:', list.length, 'msgs');
        onUpdate(list);
      },
      (err) => {
        console.error('[Chat] listenForMessages error:', err.code, err.message);
        onUpdate([]);
      }
    );
    
    return unsub;
  } catch (err) {
    console.error('[Chat] listenForMessages setup error:', err.message);
    return () => {};
  }
};

// Function to update user online status
export const updateUserStatus = (userUid, isOnline) => {
  if (!userUid) {
    console.warn('[Chat] No userUid provided for status update');
    return;
  }

  const statusRef = ref(realtimeDb, `status/${userUid}`);
  const statusData = isOnline
    ? { online: true, lastSeen: null }
    : { online: false, lastSeen: Date.now() };

  set(statusRef, statusData)
    .then(() => console.log('[Chat] User status updated:', statusData))
    .catch((err) => console.error('[Chat] Failed to update user status:', err.message));
};

// Function to listen for user online status
export const listenForUserStatus = (userUid, onUpdate) => {
  if (!userUid) {
    console.warn('[Chat] No userUid provided for status listener');
    return () => {};
  }

  const statusRef = ref(realtimeDb, `status/${userUid}`);
  const unsub = onValue(statusRef, (snap) => {
    const status = snap.val();
    console.log('[Chat] User status update:', status);
    onUpdate(status);
  });

  return () => {
    unsub();
    console.log('[Chat] Stopped listening for user status:', userUid);
  };
};

// Function to listen for last messages in a conversation
export const listenForLastMessages = (conversationId, onUpdate) => {
  if (!conversationId) {
    console.warn('[Chat] No conversationId provided for last messages listener');
    return () => {};
  }

  const lastMessageRef = ref(realtimeDb, `conversations/${conversationId}/lastMessage`);
  const unsub = onValue(lastMessageRef, (snap) => {
    const lastMessage = snap.val();
    console.log('[Chat] Last message update:', lastMessage);
    onUpdate(lastMessage);
  });

  return () => {
    unsub();
    console.log('[Chat] Stopped listening for last messages in:', conversationId);
  };
};

export const fetchOldConversations = async (userUid) => {
  console.log('[Chat] Fetching old conversations for:', userUid);

  if (!userUid) {
    console.warn('[Chat] No userUid provided');
    return [];
  }

  try {
    const convsRef = collection(db, 'conversations');
    const q = query(convsRef, where('participants', 'array-contains', userUid), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);

    const conversations = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    console.log('[Chat] Fetched conversations:', conversations.length);
    return conversations;
  } catch (err) {
    console.error('[Chat] fetchOldConversations error:', err.message);
    return [];
  }
};
















