import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Box, Paper, Typography, TextField, IconButton, Divider } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../context/AuthContext';
import { getOrCreateConversation, listenForConversations } from '../services/chatServiceV2';
import { sendMessageRealtime, listenForMessagesRealtime } from '../services/chatRealtimeService';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import ChatMessageBubble from '../components/c.jsx';

const ChatInbox = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null);
  const messagesEndRef = useRef(null);

  console.log('ChatInbox: Component rendered. UID from useParams:', uid);

  if (!uid) {
    console.error('ChatInbox: UID is missing or invalid.');
    return <div>Error: Invalid conversation ID.</div>;
  }

  useEffect(() => {
    console.log('ChatInbox: Received conversation ID:', uid);
    if (!user?.uid) {
      console.warn('ChatInbox: User UID is not available.');
      return;
    }

    let active = true;
    (async () => {
      try {
        console.log('ChatInbox: Attempting to get or create conversation for user:', user.uid, 'and uid:', uid);
        const conversation = await getOrCreateConversation(user.uid, uid);
        if (active) {
          console.log('ChatInbox: Conversation retrieved:', conversation);
          setConv(conversation);
        }
      } catch (error) {
        console.error('ChatInbox: Failed to open conversation:', error);
      }
    })();

    return () => {
      console.log('ChatInbox: Cleaning up conversation effect.');
      active = false;
    };
  }, [user?.uid, uid]);

  useEffect(() => {
    if (!conv?.id) {
      setMessages([]);
      return;
    }

    const localMessages = [];
    let unsub;
    try {
      unsub = listenForMessagesRealtime(conv.id, (msg) => {
        if (!msg) return;
        if (msg.timestamp == null) msg.timestamp = Date.now();
        localMessages.push(msg);
        localMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages([...localMessages]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
    } catch (err) {
      console.error('listenForMessagesRealtime threw:', err);
    }

    return () => {
      console.log('Cleaning up message listener. Value of unsub:', unsub);
      if (typeof unsub === 'function') {
        unsub();
      } else {
        console.warn('Unsub is not a function during cleanup. Value:', unsub);
      }
    };
  }, [conv]);

  useEffect(() => {
    const statusRef = ref(realtimeDb, `status/${uid}`);
    const unsubscribe = onValue(statusRef, (snap) => setStatus(snap.val()));

    return () => {
      console.log('Cleaning up status listener. Value of unsubscribe:', unsubscribe);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      } else {
        console.warn('Unsubscribe is not a function during cleanup. Value:', unsubscribe);
      }
    };
  }, [uid]);

  const handleSend = async () => {
    if (!text.trim() || !conv?.id || !user?.uid) return;
    const payload = { senderId: user.uid, text: text.trim(), timestamp: Date.now() };
    try {
      await sendMessageRealtime(conv.id, payload);
      setText('');
    } catch (err) {
      console.error('sendMessageRealtime error:', err);
    }
  };

  return (
    <Container maxWidth="md" sx={{ minHeight: '100vh', pt: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Chat
        </Typography>
        <Box>{status?.online ? 'Online' : `Last seen: ${status?.lastSeen}`}</Box>
      </Box>

      <Paper elevation={0} sx={{ display: 'flex', flexDirection: 'column', minHeight: '70vh', p: 2, background: 'transparent' }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {messages.map((m, i) => (
            <ChatMessageBubble key={m.id || i} m={m} meId={user?.uid} />
          ))}
          <div ref={messagesEndRef} />
        </Box>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
          <IconButton onClick={handleSend} disabled={!text.trim()}>
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChatInbox;