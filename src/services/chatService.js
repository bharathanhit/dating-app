import { db } from '../config/firebase.js';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';

// Deterministic conversation id for two users (sorted uids)
const conversationIdFor = (uidA, uidB) => {
  const [a, b] = [uidA, uidB].sort();
  return `conv_${a}_${b}`;
};

export const getOrCreateConversation = async (uidA, uidB, meta = {}) => {
  console.log('[getOrCreateConversation] Creating/getting conversation:', { uidA, uidB });
  const convId = conversationIdFor(uidA, uidB);
  const convRef = doc(db, 'conversations', convId);
  try {
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      console.log('[getOrCreateConversation] Conversation exists:', convId);
      return { id: convId, ...convSnap.data() };
    }
    console.log('[getOrCreateConversation] Creating new conversation:', convId);

    const data = {
      id: convId,
      participants: [uidA, uidB],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: meta.lastMessage || null,
      meta: meta || {},
    };
    await setDoc(convRef, data);
    console.log('[getOrCreateConversation] New conversation created:', convId);
    return { id: convId, ...data };
  } catch (err) {
    console.error('[getOrCreateConversation] Error:', err.message, err.code);
    throw err;
  }
};

export const sendMessage = async (conversationId, fromUid, text) => {
  console.log('sendMessage called:', { conversationId, fromUid, text });
  
  if (!conversationId) throw new Error('conversationId is required');
  if (!fromUid) throw new Error('fromUid is required');
  if (!text) throw new Error('text cannot be empty');

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const msg = {
      from: fromUid,
      text: text || '',
      createdAt: serverTimestamp(),
    };
    console.log('Adding message to collection:', messagesRef.path);
    const docRef = await addDoc(messagesRef, msg);
    console.log('Message added with ID:', docRef.id);

    // update conversation lastMessage and updatedAt
    const convRef = doc(db, 'conversations', conversationId);
    console.log('Updating conversation:', conversationId);
    await updateDoc(convRef, {
      lastMessage: { text: msg.text, from: fromUid },
      updatedAt: serverTimestamp(),
    });
    console.log('Conversation updated');

    return docRef.id;
  } catch (err) {
    console.error('Error in sendMessage:', err);
    throw err;
  }
};

export const listenForConversations = (userUid, onUpdate) => {
  console.log('[listenForConversations] Starting listener for:', userUid);
  if (!userUid) return () => {};
  const convsRef = collection(db, 'conversations');
  // We'll listen to all conversations and filter client-side because we used deterministic ids
  // Query by updatedAt desc to get most recent first
  const q = query(convsRef, orderBy('updatedAt', 'desc'));
  const unsub = onSnapshot(q, (snap) => {
    console.log('[listenForConversations] Snapshot received, total docs:', snap.size);
    const list = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      console.log('[listenForConversations] Checking doc:', docSnap.id, 'participants:', data.participants);
      if (Array.isArray(data.participants) && data.participants.includes(userUid)) {
        console.log('[listenForConversations] Added conversation:', docSnap.id);
        list.push({ id: docSnap.id, ...data });
      }
    });
    console.log('[listenForConversations] Final list:', list.length, 'conversations');
    onUpdate(list);
  }, (err) => {
    console.error('[listenForConversations] Error:', err.message, err.code);
  });
  return unsub;
};

export const listenForMessages = (conversationId, onUpdate) => {
  console.log('[listenForMessages] Starting listener for conversation:', conversationId);
  if (!conversationId) return () => {};
  const msgsRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(msgsRef, orderBy('createdAt', 'asc'));
  const unsub = onSnapshot(q, (snap) => {
    console.log('[listenForMessages] Snapshot received for', conversationId, 'total messages:', snap.size);
    const list = [];
    snap.forEach((docSnap) => {
      const msgData = { id: docSnap.id, ...docSnap.data() };
      console.log('[listenForMessages] Message:', msgData.id, 'from:', msgData.from, 'text:', msgData.text);
      list.push(msgData);
    });
    onUpdate(list);
  }, (err) => {
    console.error('[listenForMessages] Error:', err.message, err.code);
  });
  return unsub;
};
