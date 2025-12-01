import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserProfile } from '../services/userService';
import { Box, Container, Typography, Avatar, Chip, Button, CircularProgress } from '@mui/material';

import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

const PublicProfilePage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    getUserProfile(uid)
      .then((p) => {
        setProfile(p);
      })
      .catch((err) => {
        console.error('Failed to fetch profile', err);
        setError('Failed to load profile');
      })
      .finally(() => setLoading(false));

    // Listen for online status
    const statusRef = ref(realtimeDb, `status/${uid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      setIsOnline(data?.online || false);
    });

    return () => unsubscribe();
  }, [uid]);

  if (loading) return <Container sx={{ pt: 4 }}><CircularProgress /></Container>;
  if (error) return <Container sx={{ pt: 4 }}><Typography color="error">{error}</Typography></Container>;
  if (!profile) return <Container sx={{ pt: 4 }}><Typography>No profile found.</Typography></Container>;

  const age = profile.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null;

  return (
    <Container maxWidth="md" sx={{ pt: 4, pb: { xs: 10, sm: 6 } }}>
      <Box display="flex" gap={3} alignItems="center" mb={2}>
        <Box sx={{ position: 'relative' }}>
          <Avatar src={profile.image || profile.avatar} sx={{ width: 120, height: 120 }} />
          {isOnline && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: '#00e676',
                border: '3px solid white',
              }}
            />
          )}
        </Box>
        <Box>
          <Typography variant="h4">{profile.name} {age ? `, ${age}` : ''}</Typography>
          {profile.location && <Typography color="text.secondary">{profile.location}</Typography>}
        </Box>
      </Box>

      {profile.bio && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1">{profile.bio}</Typography>
        </Box>
      )}

      {Array.isArray(profile.interests) && profile.interests.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {profile.interests.map((i, idx) => <Chip key={idx} label={i} />)}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={async () => {
            // Open or create conversation, then navigate to messagesv2 with the other user's UID
            navigate(`/messagesv2?uid=${uid}`);
          }}
        >
          Message
        </Button>
        <Button variant="outlined" onClick={() => navigate('/likes')}>Back to Likes</Button>
      </Box>
    </Container>
  );
};

export default PublicProfilePage;
