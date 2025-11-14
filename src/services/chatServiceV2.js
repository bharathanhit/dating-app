import { db } from '../config/firebase.js';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, where } from 'firebase/firestore';

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
    const q = query(convsRef, orderBy('updatedAt', 'desc'));
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.participants?.includes(userUid)) {
            list.push({ id: docSnap.id, ...data });
          }
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
