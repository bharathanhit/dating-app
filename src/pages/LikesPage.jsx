import React, { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemAvatar, Avatar, ListItemText, IconButton, Divider, Paper } from '@mui/material';
import { Clear, ChatBubble } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { removeLikedProfile, getLikedProfiles } from '../services/userService';
import { useNavigate } from 'react-router-dom';

const LikesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLiked = async () => {
    if (!user || !user.uid) return;
    setLoading(true);
    setError('');
    try {
      const data = await getLikedProfiles(user.uid);
      setLiked(data);
    } catch (err) {
      setError('Failed to load liked profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiked();
    // eslint-disable-next-line
  }, [user?.uid]);

  const handleUnlike = async (likedUid) => {
    try {
      if (!user || !user.uid) return;
      await removeLikedProfile(user.uid, likedUid);
      await fetchLiked();
    } catch (err) {
      setError('Failed to unlike');
      console.error('Failed to unlike', err);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '80vh', maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, color: '#7a2fff', fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}>Liked Profiles</Typography>
      {loading && <Typography sx={{ color: '#888', textAlign: 'center', my: 4 }}>Loading...</Typography>}
      {error && <Typography sx={{ color: 'red', textAlign: 'center', my: 2 }}>{error}</Typography>}
      {!loading && liked.length === 0 && (
        <Typography sx={{ color: '#333', textAlign: 'center', mt: 6 }}>You haven't liked anyone yet.</Typography>
      )}
      <List sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        {liked.map((p) => (
          <Paper key={p.uid} elevation={3} sx={{ borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 6 } }}>
            <Avatar src={p.image || ''} sx={{ width: 64, height: 64, border: '2px solid #7a2fff' }} />
            <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/profile/${p.uid}`)} style={{ cursor: 'pointer' }}>
              <Typography variant="subtitle1" sx={{ color: '#222', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name || 'Unknown'}</Typography>
            </Box>
            <IconButton edge="end" onClick={() => navigate('/messagesv2', { state: { recipientId: p.uid, recipientName: p.name } })} aria-label={`message ${p.name}`} size="medium">
              <ChatBubble sx={{ color: '#7a2fff' }} />
            </IconButton>
            <IconButton edge="end" onClick={() => handleUnlike(p.uid)} aria-label={`unlike ${p.name}`} size="medium">
              <Clear sx={{ color: '#ff5fa2' }} />
            </IconButton>
          </Paper>
        ))}
      </List>
    </Box>
  );
};

export default LikesPage;
