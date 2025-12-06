import React, { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemAvatar, Avatar, ListItemText, IconButton, Divider, Paper, Tabs, Tab, Button, Grid, Alert } from '@mui/material';
import { Clear, ChatBubble, Lock } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { removeLikedProfile, getLikedProfiles, getLikedByProfiles, addLikedProfile } from '../services/userService';
import { unlockLikesFeature } from '../services/coinService';
import { useNavigate, useLocation } from 'react-router-dom';
import SEOHead from '../components/SEOHead.jsx';

const LikesPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabIndex, setTabIndex] = useState(location.state?.tab || 0); // 0: My Likes, 1: Liked Me

  // My Likes State
  const [liked, setLiked] = useState([]);
  const [loading, setLoading] = useState(true);

  // Liked Me State
  const [likedBy, setLikedBy] = useState([]);
  const [loadingLikedBy, setLoadingLikedBy] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [error, setError] = useState('');

  // Check unlock status
  useEffect(() => {
    if (profile?.likesUnlockExpiresAt) {
      const expiresAt = new Date(profile.likesUnlockExpiresAt);
      if (expiresAt > new Date()) {
        setIsUnlocked(true);
      } else {
        setIsUnlocked(false);
      }
    } else {
      setIsUnlocked(false);
    }
  }, [profile]);

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

  const fetchLikedBy = async () => {
    if (!user || !user.uid) return;
    setLoadingLikedBy(true);
    try {
      const data = await getLikedByProfiles(user.uid);
      setLikedBy(data);
    } catch (err) {
      console.error('Failed to load liked by profiles', err);
    } finally {
      setLoadingLikedBy(false);
    }
  };

  useEffect(() => {
    fetchLiked();
    if (tabIndex === 1) {
      fetchLikedBy();
    }
    // eslint-disable-next-line
  }, [user?.uid, tabIndex]);

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

  const handleUnlock = async () => {
    if (!user?.uid) return;

    if (window.confirm('Unlock "Who Liked Me" for 10 coins? Access lasts for 1 week.')) {
      setLoadingLikedBy(true);
      try {
        const result = await unlockLikesFeature(user.uid);
        if (result.success) {
          await refreshProfile();
          // setIsUnlocked(true) will be handled by the useEffect listening to profile
          await fetchLikedBy();
        } else {
          alert('Failed to unlock: ' + (result.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Error unlocking:', err);
        alert('Error processing unlock');
      } finally {
        setLoadingLikedBy(false);
      }
    }
  };

  const handleLikeBack = async (profile) => {
    try {
      if (!user || !user.uid) return;
      await addLikedProfile(user.uid, profile);
      alert(`You liked ${profile.name} back! It's a match!`);
    } catch (err) {
      console.error('Failed to like back', err);
      alert('Failed to like back');
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  return (
    <>
      <SEOHead
        title="Likes | Bichat Dating"
        description="See who you like and who likes you on Bichat"
        noindex={true}
      />
      <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '80vh', maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 2, color: '#7a2fff', fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}>
          Likes
        </Typography>

        <Paper elevation={0} sx={{ mb: 3, bgcolor: 'transparent' }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            centered
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': { fontWeight: 600, fontSize: '1rem' },
              '& .Mui-selected': { color: '#7a2fff !important' },
              '& .MuiTabs-indicator': { backgroundColor: '#7a2fff' }
            }}
          >
            <Tab label="My Likes" />
            <Tab label="Liked Me" />
          </Tabs>
        </Paper>

        {error && <Typography sx={{ color: 'red', textAlign: 'center', my: 2 }}>{error}</Typography>}

        {/* MY LIKES TAB */}
        {tabIndex === 0 && (
          <Box>
            {loading && <Typography sx={{ color: '#888', textAlign: 'center', my: 4 }}>Loading...</Typography>}
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
        )}

        {/* LIKED ME TAB */}
        {tabIndex === 1 && (
          <Box>
            {loadingLikedBy && <Typography sx={{ color: '#888', textAlign: 'center', my: 4 }}>Loading...</Typography>}

            {/* LOCKED STATE */}
            {!isUnlocked && !loadingLikedBy && (
              <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                <Lock sx={{ fontSize: 60, color: '#aaa', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Who Liked You?</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  See the people who liked your profile. Unlock to see their photos and start chatting!
                </Typography>

                {likedBy.length > 0 && (
                  <Typography sx={{ mb: 3, fontWeight: 500, color: '#7a2fff' }}>
                    {likedBy.length} people liked you recently!
                  </Typography>
                )}

                <Button
                  variant="contained"
                  onClick={handleUnlock}
                  sx={{
                    bgcolor: '#7a2fff',
                    borderRadius: 20,
                    px: 4,
                    py: 1.5,
                    fontSize: '1rem',
                    boxShadow: '0 4px 15px rgba(122, 47, 255, 0.4)',
                    '&:hover': { bgcolor: '#6920e0' }
                  }}
                >
                  Unlock for 10 Coins (1 Week)
                </Button>

                {/* Blurry preview */}
                <List sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 4, opacity: 0.5, pointerEvents: 'none', filter: 'blur(4px)' }}>
                  {[1, 2, 3].map((i) => (
                    <Paper key={i} elevation={1} sx={{ borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 64, height: 64 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ bgcolor: '#ddd', width: '50%', height: 20, borderRadius: 1 }} />
                      </Box>
                    </Paper>
                  ))}
                </List>
              </Box>
            )}

            {/* UNLOCKED STATE */}
            {isUnlocked && !loadingLikedBy && (
              <Box>
                {likedBy.length === 0 ? (
                  <Typography sx={{ color: '#333', textAlign: 'center', mt: 6 }}>No one has liked you yet. Keep your profile updated!</Typography>
                ) : (
                  <List sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    {likedBy.map((p) => (
                      <Paper key={p.uid} elevation={3} sx={{ borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 6 } }}>
                        <Avatar src={p.image || ''} sx={{ width: 64, height: 64, border: '2px solid #7a2fff' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/profile/${p.uid}`)} style={{ cursor: 'pointer' }}>
                          <Typography variant="subtitle1" sx={{ color: '#222', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {p.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Liked {p.likedAt ? new Date(p.likedAt.toMillis ? p.likedAt.toMillis() : p.likedAt).toLocaleDateString() : 'recently'}
                          </Typography>
                        </Box>

                        {/* Actions enabled */}
                        <IconButton edge="end" onClick={() => navigate('/messagesv2', { state: { recipientId: p.uid, recipientName: p.name } })} aria-label={`message ${p.name}`} size="medium">
                          <ChatBubble sx={{ color: '#7a2fff' }} />
                        </IconButton>

                        <Button
                          variant="contained"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleLikeBack(p); }}
                          sx={{
                            ml: 1,
                            minWidth: 'auto',
                            bgcolor: '#ff4081',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            '&:hover': { bgcolor: '#f50057' }
                          }}
                        >
                          Like Back
                        </Button>
                      </Paper>
                    ))}
                  </List>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </>
  );
};
export default LikesPage;
