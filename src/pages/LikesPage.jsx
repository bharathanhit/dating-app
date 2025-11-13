import React from 'react';
import { Box, Typography, List, ListItem, ListItemAvatar, Avatar, ListItemText, IconButton, Divider, Paper } from '@mui/material';
import { Clear, ChatBubble } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { removeLikedProfile } from '../services/userService';
import { useNavigate } from 'react-router-dom';

const LikesPage = () => {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const liked = Array.isArray(profile?.likedProfiles) ? profile.likedProfiles : [];

  const handleUnlike = async (likedUid) => {
    try {
      if (!user || !user.uid) return;
      await removeLikedProfile(user.uid, likedUid);
      await refreshProfile();
    } catch (err) {
      console.error('Failed to unlike', err);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '80vh' }}>
      <Typography variant="h5" sx={{ mb: 2, color: '#000' }}>Liked Profiles</Typography>
      {liked.length === 0 && (
        <Typography sx={{ color: '#333' }}>You haven't liked anyone yet.</Typography>
      )}

      <List sx={{ display: 'grid', gap: 1 }}>
        {liked.map((p) => {
          // compute age from birthDate if available
          let age = null;
          try {
            if (p.birthDate) {
              const bd = new Date(p.birthDate);
              if (!isNaN(bd)) {
                age = Math.floor((Date.now() - bd.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
              }
            }
          } catch (err) {
            age = null;
          }

          return (
            <React.Fragment key={p.uid}>
              <Paper elevation={1} sx={{ p: 1, borderRadius: 2 }}>
                <ListItem
                  button
                  onClick={() => navigate(`/profile/${p.uid}`)}
                  sx={{ px: 1 }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <IconButton
                        edge="end"
                        onClick={(e) => { e.stopPropagation(); navigate('/messages', { state: { recipientUid: p.uid, recipientName: p.name } }); }}
                        aria-label={`message ${p.name}`}
                        size="small"
                      >
                        <ChatBubble sx={{ color: '#000' }} />
                      </IconButton>
                      <IconButton edge="end" onClick={(e) => { e.stopPropagation(); handleUnlike(p.uid); }} aria-label={`unlike ${p.name}`} size="small">
                        <Clear sx={{ color: '#000' }} />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={p.image || ''} sx={{ width: 64, height: 64 }} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={p.name || 'Unknown'}
                    secondary={
                      age ? (
                        <Typography component="span" sx={{ color: '#7F00FF', fontWeight: 600 }}>{`${age} yrs`}</Typography>
                      ) : null
                    }
                    primaryTypographyProps={{ sx: { color: '#000', fontWeight: 700 } }}
                  />
                </ListItem>
              </Paper>
            </React.Fragment>
          );
        })}
      </List>
    </Box>
  );
};

export default LikesPage;
