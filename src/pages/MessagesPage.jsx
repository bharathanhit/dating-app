import React, { useEffect, useState, useRef } from 'react';
import { Container, Grid, Paper, Typography, Avatar, Box, List, ListItem, ListItemAvatar, ListItemText, Divider, TextField, IconButton, Button, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../context/AuthContext';
import { getOrCreateConversation, listenForConversations } from '../services/chatServiceV2';
import { sendMessageRealtime, listenForMessagesRealtime } from '../services/chatRealtimeService';
import { getUserProfile } from '../services/userService';

const MessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [otherProfile, setOtherProfile] = useState(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.uid) return;
    setLoadingConv(true);
    const unsub = listenForConversations(user.uid, (list) => {
      setConversations(list);
      setLoadingConv(false);
    });
    return unsub;
  }, [user]);

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

  useEffect(() => {
    let mounted = true;
    if (!activeConv || !user) {
      setOtherProfile(null);
      return;
    }
    // Defensive: ensure participants is a valid array with 2 unique UIDs
    const participants = Array.isArray(activeConv.participants) ? activeConv.participants.filter(Boolean) : [];
    if (participants.length !== 2 || !participants.includes(user.uid)) {
      setOtherProfile(null);
      console.error('Conversation participants invalid:', participants);
      return;
    }
    const otherUid = participants.find((id) => id !== user.uid);
    if (!otherUid) {
      setOtherProfile(null);
      return;
    }
    getUserProfile(otherUid)
      .then((p) => { if (mounted) setOtherProfile(p); })
      .catch((e) => { console.error('Failed to load other profile', e); });
    return () => { mounted = false; };
  }, [activeConv, user]);

  const computeAge = (birthDate) => {
    if (!birthDate) return null;
    let d;
    try {
      if (birthDate.seconds) d = new Date(birthDate.seconds * 1000);
      else d = new Date(birthDate);
    } catch (e) {
      return null;
    }
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const openConversationWith = async (otherUid) => {
    if (!user || !user.uid) return;
    try {
      const conv = await getOrCreateConversation(user.uid, otherUid);
      setActiveConv(conv);
      setError('');
    } catch (err) {
      console.error('Failed to open conversation', err);
      setError('Failed to open conversation: ' + err.message);
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
      console.error('Failed to send message', err);
      setError('Failed to send message: ' + (err.message || err));
    }
  };



  const startWithUser = async (uid) => {
    await openConversationWith(uid);
  };

  return (
    <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 }, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            background: 'linear-gradient(135deg, #7a2fff 0%, #ff5fa2 50%, #ffa500 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            fontWeight: 700,
          }}
        >
          Messages
        </Typography>
        {/* Removed Test and Debug Send buttons */}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 1, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                px: 1,
                py: 0.5,
                background: 'linear-gradient(90deg, #7a2fff 0%, #ff5fa2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 600,
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
                        </List>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Paper sx={{ p: 2, minHeight: 400, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}>
                        {activeConv && otherProfile ? (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <Avatar src={otherProfile.photoURL} alt={otherProfile.displayName} sx={{ mr: 2 }} />
                              <Box>
                                <Typography variant="h6">{otherProfile.displayName || 'User'}</Typography>
                                {otherProfile.birthDate && (
                                  <Typography variant="body2" color="text.secondary">
                                    Age: {computeAge(otherProfile.birthDate)}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
                              {messages.map((msg, idx) => (
                                <Box
                                  key={idx}
                                  sx={{
                                    display: 'flex',
                                    flexDirection: msg.senderId === user.uid ? 'row-reverse' : 'row',
                                    alignItems: 'flex-end',
                                    mb: 1,
                                  }}
                                >
                                  <Avatar
                                    src={msg.senderId === user.uid ? user.photoURL : otherProfile.photoURL}
                                    alt=""
                                    sx={{ width: 32, height: 32, mx: 1 }}
                                  />
                                  <Box
                                    sx={{
                                      bgcolor: msg.senderId === user.uid ? '#7a2fff22' : '#ff5fa222',
                                      borderRadius: 2,
                                      px: 2,
                                      py: 1,
                                      maxWidth: '70%',
                                    }}
                                  >
                                    <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                                      {msg.text}
                                    </Typography>
                                  </Box>
                                </Box>
                              ))}
                              <div ref={messagesEndRef} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Type your message..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                  }
                                }}
                                sx={{ mr: 1 }}
                              />
                              <IconButton color="primary" onClick={handleSend} disabled={!text.trim()}>
                                <SendIcon />
                              </IconButton>
                            </Box>
                          </>
                        ) : (
                          <Box sx={{ textAlign: 'center', mt: 8 }}>
                            <Typography variant="h6" color="text.secondary">
                              Select a conversation to start messaging.
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>
                </Container>
              );
            };
            
            // ConversationListItem component
            const ConversationListItem = ({ conv, otherUid, onOpen }) => {
              const [profile, setProfile] = useState(null);
            
              useEffect(() => {
                let mounted = true;
                if (otherUid) {
                  getUserProfile(otherUid).then((p) => {
                    if (mounted) setProfile(p);
                  });
                }
                return () => { mounted = false; };
              }, [otherUid]);
            
              return (
                <ListItem button onClick={onOpen}>
                  <ListItemAvatar>
                    <Avatar src={profile?.photoURL} alt={profile?.displayName || 'User'} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={profile?.displayName || 'User'}
                    secondary={conv.lastMessage ? conv.lastMessage.text : ''}
                  />
                </ListItem>
              );
            };
            
            export default MessagesPage;
