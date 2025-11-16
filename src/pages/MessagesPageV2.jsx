// MessagesPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Avatar,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  TextField,
  IconButton
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../context/AuthContext';
import { getOrCreateConversation, listenForConversations } from '../services/chatServiceV2';
import { sendMessageRealtime, listenForMessagesRealtime } from '../services/chatRealtimeService';
import { getUserProfile } from '../services/userService';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

const MessagesPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [error, setError] = useState('');
  const [receiver, setReceiver] = useState(null);
  const [status, setStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // listen for conversations
  useEffect(() => {
    if (!user || !user.uid) {
      console.warn('MessagesPage: no user available yet.');
      return undefined;
    }

    setLoadingConv(true);

    let unsubConversations;
    try {
      unsubConversations = listenForConversations(user.uid, (list) => {
        setConversations(Array.isArray(list) ? list : []);
        setLoadingConv(false);
      });
    } catch (err) {
      console.error('listenForConversations threw:', err);
      setLoadingConv(false);
    }

    const params = new URLSearchParams(location.search);
    const targetUid = params.get('uid');
    if (targetUid && targetUid !== user.uid) {
      openConversationWith(targetUid).catch((e) => console.error('openConversationWith error:', e));
    }

    // cleanup: only call if function
    return () => {
      if (typeof unsubConversations === 'function') unsubConversations();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.search]);

  // listen for messages in the active conversation
  useEffect(() => {
    if (!activeConv || !activeConv.id) {
      setMessages([]);
      return undefined;
    }

    const localMessages = [];

    let unsubMessages;
    try {
      unsubMessages = listenForMessagesRealtime(activeConv.id, (msg) => {
        if (!msg) return;

        // normalize: ensure timestamp exists
        if (msg.timestamp == null) {
          // try to preserve order by assigning a fallback
          msg.timestamp = Date.now();
        }

        localMessages.push(msg);

        // keep sorted by timestamp ascending
        localMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        setMessages([...localMessages]);

        // auto-scroll
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
    } catch (err) {
      console.error('listenForMessagesRealtime threw:', err);
    }

    return () => {
      if (typeof unsubMessages === 'function') unsubMessages();
    };
  }, [activeConv]);

  // Fetch online status of the receiver
  useEffect(() => {
    if (!receiver?.uid) return;

    const statusRef = ref(realtimeDb, `status/${receiver.uid}`);
    return onValue(statusRef, (snap) => {
      setStatus(snap.val());
    });
  }, [receiver]);

  const openConversationWith = async (otherUid) => {
    if (!user || !user.uid) {
      const msg = 'openConversationWith called but user is not ready';
      console.warn(msg);
      setError(msg);
      return;
    }
    if (!otherUid) {
      const msg = 'openConversationWith called with invalid otherUid';
      console.warn(msg);
      setError(msg);
      return;
    }

    try {
      const conv = await getOrCreateConversation(user.uid, otherUid);
      if (!conv) throw new Error('getOrCreateConversation returned falsy value');
      setActiveConv(conv);
      setError('');
      setReceiver({ uid: otherUid }); // Set receiver state
    } catch (err) {
      console.error('Failed to open conversation:', err);
      setError('Failed to open conversation: ' + (err?.message || err));
    }
  };

  const handleSend = async () => {
    if (!text.trim()) {
      setError('Message is empty');
      return;
    }
    if (!activeConv || !activeConv.id) {
      setError('No conversation selected');
      return;
    }
    if (!user || !user.uid) {
      setError('User not authenticated');
      return;
    }

    const payload = {
      senderId: user.uid,
      text: text.trim(),
      timestamp: Date.now()
    };

    try {
      await sendMessageRealtime(activeConv.id, payload);
      setText('');
      setError('');
    } catch (err) {
      console.error('sendMessageRealtime error:', err);
      setError('Failed to send message: ' + (err?.message || err));
    }
  };

  const startWithUser = async (uid) => {
    await openConversationWith(uid);
  };

  // sortedMessages is guaranteed sorted ascending by timestamp
  const sortedMessages = Array.isArray(messages)
    ? [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    : [];

  const renderStatus = () => {
    if (!status) return null;

    if (status.online) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: 'green', borderRadius: '50%' }}></div>
          <span style={{ color: 'green', fontSize: '0.875rem', fontWeight: 'bold' }}>Online</span>
        </div>
      );
    }

    return (
      <span style={{ color: 'gray', fontSize: '0.875rem' }}>
        Last seen: {status.lastSeen ? new Date(status.lastSeen).toLocaleString() : '—'}
      </span>
    );
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ minHeight: '100vh', pb: 0, background: 'linear-gradient(135deg, #f8f4ff 0%, #fff 100%)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, px: { xs: 2, md: 6 }, pt: 3 }}>
        <Typography
          variant="h3"
          sx={{
            background: 'linear-gradient(135deg, #441792ff 0%, #5d197cff 50%, #5a2480ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            fontWeight: 700
          }}
        >
          Messages
        </Typography>
      </Box>

      <Grid container>
        <Grid item xs={12} md={4} sx={{ minHeight: 'calc(100vh - 64px)', borderRight: '1px solid rgba(122,47,255,0.08)', background: 'rgba(255,255,255,0.7)' }}>
          <Paper elevation={0} sx={{ p: 1, background: 'transparent', boxShadow: 'none' }}>
            <Typography
              variant="subtitle1"
              sx={{
                px: 1,
                py: 0.5,
                background: 'linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 600
              }}
            >
              Conversations
            </Typography>
            <Divider />
            <List>
              {conversations.map((c) => {
                const other = (c.participants || []).find((id) => id !== user?.uid);
                return (
                  <ConversationListItem key={c.id || JSON.stringify(c)} conv={c} otherUid={other} onOpen={() => startWithUser(other)} />
                );
              })}
              {conversations.length === 0 && (
                <ListItem>
                  <ListItemText primary={loadingConv ? 'Loading conversations...' : 'No conversations yet. Like someone to start!'} />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8} sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(122,47,255,0.03) 0%, rgba(255,95,162,0.03) 100%)', p: 0 }}>
          <Paper elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', boxShadow: 'none', p: 0 }}>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {!activeConv ? (
                <Typography sx={{ textAlign: 'center', mt: 5, background: 'linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Select a conversation to start chatting.
                </Typography>
              ) : (
                <Box>
                  {sortedMessages.length === 0 ? (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                      {activeConv?.lastMessage || 'No messages yet. Start the conversation!'}
                    </Typography>
                  ) : (
                    <>
                      {sortedMessages.map((m, index) => {
                        const messageDate = m.timestamp ? new Date(m.timestamp) : null;

                        const showDate =
                          index === 0 ||
                          (messageDate &&
                            new Date(sortedMessages[index - 1]?.timestamp).toDateString() !== messageDate.toDateString());

                        return (
                          <React.Fragment key={m.id || m.timestamp || index}>
                            {showDate && messageDate && !isNaN(messageDate.getTime()) && (
                              <Typography sx={{ textAlign: 'center', color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem', my: 1 }}>
                                {messageDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', justifyContent: m.senderId === user?.uid ? 'flex-end' : 'flex-start', mb: 1 }}>
                              <Box sx={{
                                maxWidth: '75%',
                                p: 1.25,
                                borderRadius: 2,
                                background: m.senderId === user?.uid ? 'linear-gradient(135deg, #7a2fff 0%, #ff5fa2 100%)' : 'linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%)',
                                boxShadow: m.senderId === user?.uid ? '0 4px 12px rgba(122,47,255,0.18)' : '0 2px 6px rgba(0,0,0,0.06)',
                                color: m.senderId === user?.uid ? 'white' : '#333'
                              }}>
                                <Typography sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{m.text}</Typography>
                                {messageDate && !isNaN(messageDate.getTime()) && (
                                  <Typography sx={{ fontSize: '0.75rem', color: m.senderId === user?.uid ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)', mt: 0.5 }}>
                                    {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </Box>
              )}
            </Box>

            <Box sx={{ p: 1.5, borderTop: '1px solid rgba(122,47,255,0.08)', display: 'flex', gap: 1, background: 'rgba(255,255,255,0.6)' }}>
              <TextField
                fullWidth
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                disabled={!activeConv}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '20px',
                    background: 'white',
                  }
                }}
              />
              <IconButton
                onClick={handleSend}
                disabled={!activeConv || !text.trim()}
                sx={{
                  background: !activeConv || !text.trim() ? 'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 100%)' : 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 52,
                  height: 52
                }}
              >
                <SendIcon sx={{ fontSize: 28 }} />
              </IconButton>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

const ConversationListItem = ({ conv, otherUid, onOpen }) => {
  const [profile, setProfile] = useState(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      console.log('Swiped right for:', profile?.name || otherUid);
    } else if (info.offset.x < -150) {
      console.log('Swiped left for:', profile?.name || otherUid);
    }
  };

  useEffect(() => {
    if (!otherUid) return;

    let active = true;
    getUserProfile(otherUid)
      .then((p) => { if (active) setProfile(p); })
      .catch((err) => { console.warn('getUserProfile failed for', otherUid, err); });

    return () => { active = false; };
  }, [otherUid]);

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 1.1 }}
    >
      <ListItem
        button
        onClick={() => {
          if (typeof onOpen === 'function') onOpen();
        }}
        sx={{
          transition: 'all 0.2s ease',
          '&:hover': { background: 'linear-gradient(135deg, rgba(122,47,255,0.06) 0%, rgba(255,95,162,0.06) 100%)', transform: 'translateX(3px)' }
        }}
      >
        <ListItemAvatar>
          <Avatar src={profile?.image || ''} sx={{ border: '2px solid transparent' }} />
        </ListItemAvatar>

        <ListItemText
          primary={profile?.name || otherUid}
          secondary={conv?.lastMessage?.text || 'No messages yet'}
        />
      </ListItem>
    </motion.div>
  );
};

export default MessagesPage;