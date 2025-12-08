import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Box, Paper, Typography, TextField, IconButton, Divider, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useAuth } from '../context/AuthContext';
import { getOrCreateConversation, listenForConversations } from '../services/chatServiceV2';
import { sendMessageRealtime, listenForMessagesRealtime } from '../services/chatRealtimeService';
import { getUserProfile, blockUser, unblockUser, isUserBlocked, reportUser } from '../services/userService';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import ChatMessageBubble from '../components/c.jsx';
import ReportDialog from '../components/ReportDialog';

const ChatInbox = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false); // I blocked them
  const [isBlockedByThem, setIsBlockedByThem] = useState(false); // They blocked me
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
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

  // Fetch other user's profile
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const profile = await getUserProfile(uid);
        setOtherProfile(profile);
      } catch (error) {
        console.error('Failed to fetch other user profile:', error);
      }
    })();
  }, [uid]);

  // Check if user is blocked (I blocked them)
  useEffect(() => {
    if (!user?.uid || !uid) return;
    (async () => {
      try {
        const blocked = await isUserBlocked(user.uid, uid);
        setIsBlocked(blocked);
      } catch (error) {
        console.error('Failed to check blocked status:', error);
      }
    })();
  }, [user?.uid, uid]);

  // Check if I am blocked by them
  useEffect(() => {
    if (!user?.uid || !uid) return;
    (async () => {
      try {
        const blockedByThem = await isUserBlocked(uid, user.uid);
        setIsBlockedByThem(blockedByThem);
      } catch (error) {
        console.error('Failed to check if blocked by them:', error);
      }
    })();
  }, [user?.uid, uid]);

  useEffect(() => {
    // Clear messages immediately when conversation changes
    if (!conv?.id) {
      setMessages([]);
      return;
    }

    // Reset messages before setting up new listener
    setMessages([]);

    let unsub;
    try {
      console.log('[ChatInbox] Setting up message listener for:', conv.id);
      unsub = listenForMessagesRealtime(conv.id, (messagesArray) => {
        console.log('[ChatInbox] Received messages update:', messagesArray.length);
        // Set messages directly from the listener
        setMessages(messagesArray);
        // Scroll to bottom after messages update
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
    } catch (err) {
      console.error('[ChatInbox] listenForMessagesRealtime threw:', err);
    }

    return () => {
      console.log('[ChatInbox] Cleaning up message listener for:', conv?.id);
      if (typeof unsub === 'function') {
        unsub();
      } else {
        console.warn('[ChatInbox] Unsub is not a function during cleanup. Value:', unsub);
      }
    };
  }, [conv?.id]); // Only depend on conv.id to prevent unnecessary re-renders

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

  const handleMenuOpen = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleBlockClick = () => {
    handleMenuClose();
    setBlockDialogOpen(true);
  };

  const handleBlockConfirm = async () => {
    try {
      if (isBlocked) {
        await unblockUser(user.uid, uid);
        setIsBlocked(false);
        alert('User unblocked successfully');
      } else {
        await blockUser(user.uid, uid);
        setIsBlocked(true);
        alert('User blocked successfully');
      }
      setBlockDialogOpen(false);
    } catch (error) {
      console.error('Error blocking/unblocking user:', error);
      alert(`Failed to ${isBlocked ? 'unblock' : 'block'} user: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleReportClick = () => {
    handleMenuClose();
    setReportDialogOpen(true);
  };

  const handleReportSubmit = async (category, reason) => {
    try {
      await reportUser(user.uid, uid, category, reason);
      alert('Report submitted successfully. Our team will review it.');
    } catch (error) {
      console.error('Error reporting user:', error);
      throw error;
    }
  };

  return (
    <Container maxWidth="md" sx={{ minHeight: '100vh', pt: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {(isBlocked || isBlockedByThem) ? 'Blocked User' : (otherProfile?.name || 'Chat')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {status?.online ? 'Online' : status?.lastSeen ? `Last seen: ${new Date(status.lastSeen).toLocaleString()}` : ''}
          </Typography>
          <IconButton onClick={handleMenuOpen} size="small">
            <MoreVertIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleBlockClick}>
          {isBlocked ? 'Unblock User' : 'Block User'}
        </MenuItem>
        <MenuItem onClick={handleReportClick}>Report User</MenuItem>
      </Menu>

      {/* Block Confirmation Dialog */}
      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)}>
        <DialogTitle>{isBlocked ? 'Unblock User' : 'Block User'}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isBlocked
              ? `Are you sure you want to unblock ${otherProfile?.name || 'this user'}? You will be able to see their messages again.`
              : `Are you sure you want to block ${otherProfile?.name || 'this user'}? You won't receive messages from them.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBlockConfirm} color="error" variant="contained">
            {isBlocked ? 'Unblock' : 'Block'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Dialog */}
      <ReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        onSubmit={handleReportSubmit}
        reportedUserName={otherProfile?.name}
      />

      <Paper elevation={0} sx={{ display: 'flex', flexDirection: 'column', minHeight: '70vh', p: 2, background: 'transparent' }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {messages.map((m, i) => (
            <ChatMessageBubble key={m.id || i} m={m} meId={user?.uid} />
          ))}
          <div ref={messagesEndRef} />
        </Box>
        <Divider sx={{ my: 1 }} />
        {isBlocked ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              You have blocked this user. Unblock to send messages.
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={async () => {
                try {
                  await unblockUser(user.uid, uid);
                  setIsBlocked(false);
                  alert('User unblocked successfully');
                } catch (error) {
                  console.error('Error unblocking user:', error);
                  alert('Failed to unblock user. Please try again.');
                }
              }}
            >
              Unblock User
            </Button>
          </Box>
        ) : isBlockedByThem ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', py: 2 }}>
            <Typography variant="body2" color="error" sx={{ textAlign: 'center' }}>
              This user has blocked you. You cannot send messages.
            </Typography>
          </Box>
        ) : (
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
        )}
      </Paper>
    </Container>
  );
};

export default ChatInbox;