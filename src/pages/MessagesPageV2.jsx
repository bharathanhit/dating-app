import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Grid, Paper, Typography, Avatar, Box, List, ListItem, ListItemAvatar, ListItemText, Divider, TextField, IconButton, Alert, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useAuth } from '../context/AuthContext';
import { getOrCreateConversation, listenForConversations } from '../services/chatServiceV2';
import { sendMessageRealtime, listenForMessagesRealtime } from '../services/chatRealtimeService';
import { getUserProfile } from '../services/userService';

const MessagesPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user || !user.uid) return;
    setLoadingConv(true);
    const unsub = listenForConversations(user.uid, (list) => {
      setConversations(list);
      setLoadingConv(false);
    });
    // If a ?uid= is present in the URL, auto-open that conversation
    const params = new URLSearchParams(location.search);
    const targetUid = params.get('uid');
    if (targetUid && targetUid !== user.uid) {
      openConversationWith(targetUid);
    }
    return unsub;
  }, [user, location.search]);

  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      return;
    }
    // Listen for new messages in Realtime Database
    const messages = [];
    const unsub = listenForMessagesRealtime(activeConv.id, (msg) => {
      messages.push(msg);
      setMessages([...messages]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return unsub;
  }, [activeConv]);

  const openConversationWith = async (otherUid) => {
    if (!user || !user.uid) return;
    try {
      const conv = await getOrCreateConversation(user.uid, otherUid);
      setActiveConv(conv);
      setError('');
    } catch (err) {
      setError('Failed to open conversation: ' + err.message);
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !activeConv || !user) {
      setError('Message empty or no conversation selected');
      return;
    }
    try {
      await sendMessageRealtime(activeConv.id, {
        senderId: user.uid,
        text: text.trim(),
      });
      setText('');
      setError('');
    } catch (err) {
      setError('Failed to send message: ' + (err.message || err));
      console.error(err);
    }
  };

  const testFirebase = async () => {
    console.log('[TEST] User UID:', user?.uid);
    console.log('[TEST] Conversations:', conversations);
    console.log('[TEST] Active Conv:', activeConv);
    alert(`User: ${user?.uid}\nConversations: ${conversations.length}\nActive: ${activeConv?.id || 'none'}`);
  };

  const startWithUser = async (uid) => {
    await openConversationWith(uid);
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ minHeight: '100vh', pb: 0, pt: 0, pl: 0, pr: 0, background: 'linear-gradient(135deg, #f8f4ff 0%, #fff 100%)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, px: { xs: 2, md: 6 }, pt: 3 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            background: 'linear-gradient(135deg, #7a2fff 0%, #ff5fa2 50%, #ffa500 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            fontWeight: 700
          }}
        >
          Messages
        </Typography>
        <Button startIcon={<BugReportIcon />} onClick={testFirebase} size="small" variant="outlined">
          Test
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={0} sx={{ minHeight: 'calc(100vh - 64px)' }}>
        <Grid item xs={12} md={4} sx={{ minHeight: 'calc(100vh - 64px)', borderRight: { md: '1.5px solid #eee' }, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}>
          <Paper elevation={0} sx={{ p: 1, background: 'transparent', boxShadow: 'none' }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                px: 1, 
                py: 0.5,
                background: 'linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
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
                  <ConversationListItem key={c.id} conv={c} otherUid={other} onOpen={() => startWithUser(other)} />
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
        <Grid item xs={12} md={8} sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(122,47,255,0.05) 0%, rgba(255,95,162,0.05) 100%)', border: 'none', p: 0 }}>
          <Paper elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', boxShadow: 'none', border: 'none', p: 0 }}>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {!activeConv ? (
                <Typography 
                  sx={{ 
                    background: 'linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontSize: '1.1rem'
                  }}
                >
                  Select a conversation to start chatting.
                </Typography>
              ) : (
                <Box>
                  {messages.length === 0 ? (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                      No messages yet. Start the conversation!
                    </Typography>
                  ) : (
                    <>
                      {messages.map((m) => (
                        <Box key={m.id} sx={{ display: 'flex', justifyContent: m.senderId === user.uid ? 'flex-end' : 'flex-start', mb: 1 }}>
                          <Box sx={{ 
                            maxWidth: '75%', 
                            p: 1.25, 
                            borderRadius: 2, 
                            background: m.senderId === user.uid ? 'linear-gradient(135deg, #7a2fff 0%, #ff5fa2 100%)' : 'linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%)',
                            boxShadow: m.senderId === user.uid ? '0 4px 12px rgba(122,47,255,0.3)' : '0 2px 6px rgba(0,0,0,0.1)',
                            color: m.senderId === user.uid ? 'white' : '#333'
                          }}>
                            <Typography sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{m.text}</Typography>
                          </Box>
                        </Box>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </Box>
              )}
            </Box>
            <Box sx={{ 
              p: 1.5, 
              borderTop: '1px solid rgba(122,47,255,0.15)', 
              display: 'flex', 
              gap: 1,
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(10px)'
            }}>
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
                    '& fieldset': {
                      borderColor: 'rgba(122,47,255,0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(122,47,255,0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#7a2fff',
                    }
                  },
                  '& .MuiInputBase-input::placeholder': {
                    opacity: 0.7,
                  }
                }}
              />
              <IconButton 
                onClick={handleSend} 
                disabled={!activeConv || !text.trim()}
                sx={{
                  background: !activeConv || !text.trim() 
                    ? 'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 100%)' 
                    : 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
                  color: !activeConv || !text.trim() ? '#fff' : '#fff',
                  borderRadius: '50%',
                  width: 52,
                  height: 52,
                  boxShadow: !activeConv || !text.trim() ? 'none' : '0 4px 16px 0 rgba(122,47,255,0.18)',
                  border: !activeConv || !text.trim() ? '2px solid #e0e0e0' : '2px solid #FFD700',
                  transition: 'all 0.2s',
                  '&:hover': {
                    background: !activeConv || !text.trim() 
                      ? 'linear-gradient(135deg, #bdbdbd 0%, #e0e0e0 100%)' 
                      : 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
                    boxShadow: !activeConv || !text.trim() ? 'none' : '0 6px 24px 0 rgba(255,215,0,0.18)',
                  },
                  '&:disabled': {
                    opacity: 0.5
                  }
                }}
              >
                <SendIcon sx={{ fontSize: 30, color: !activeConv || !text.trim() ? '#fff' : '#FFD700', filter: !activeConv || !text.trim() ? 'none' : 'drop-shadow(0 0 6px #7a2fff88)' }} />
              </IconButton>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

const ConversationListItem = ({ conv, otherUid, onOpen }) => {
  const [profile, setProfile] = React.useState(null);
  useEffect(() => {
    let mounted = true;
    if (!otherUid) return;
    getUserProfile(otherUid).then((p) => { if (mounted) setProfile(p); }).catch(()=>{});
    return () => { mounted = false; };
  }, [otherUid]);

  return (
    <ListItem 
      button 
      onClick={onOpen}
      sx={{
        transition: 'all 0.3s ease',
        '&:hover': {
          background: 'linear-gradient(135deg, rgba(122,47,255,0.1) 0%, rgba(255,95,162,0.1) 100%)',
          transform: 'translateX(4px)'
        }
      }}
    >
      <ListItemAvatar>
        <Avatar 
          src={profile?.image || ''} 
          sx={{
            border: '2px solid transparent',
            background: 'linear-gradient(135deg, #7a2fff 0%, #ff5fa2 100%)',
            boxShadow: '0 4px 12px rgba(122,47,255,0.3)'
          }}
        />
      </ListItemAvatar>
      <ListItemText 
        primary={
          <Typography
            sx={{
              background: 'linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: 600
            }}
          >
            {profile?.name || otherUid}
          </Typography>
        }
        secondary={
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {conv.lastMessage?.text || 'No messages yet'}
          </Typography>
        }
      />
    </ListItem>
  );
};

export default MessagesPage;
