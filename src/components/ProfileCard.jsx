import { Card, CardContent, CardMedia, Typography, Button, Grid, Box, Chip, Avatar, IconButton, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { Favorite, Clear } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { addLikedProfile, removeLikedProfile } from '../services/userService';
import { useNavigate, useLocation } from 'react-router-dom';

const ProfileCard = ({ profile, likeBtnId, passBtnId }) => {
  const { user, refreshProfile, profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLike = async () => {
    try {
      const likedUid = profile.uid || profile.id;
      if (!user || !user.uid) {
        // redirect to login and indicate intended action
        navigate('/login', { state: { from: location.pathname, action: 'like', targetUid: likedUid } });
        return;
      }
      const alreadyLiked = Array.isArray(myProfile?.likedProfiles) && myProfile.likedProfiles.some((p) => p.uid === likedUid);

      if (alreadyLiked) {
        // remove
        await removeLikedProfile(user.uid, likedUid);
      } else {
        // add minimal info
        const likedEntry = { uid: likedUid, name: profile.name || '', image: profile.image || null };
        await addLikedProfile(user.uid, likedEntry);
      }

      // refresh context profile so footer updates
      try { await refreshProfile(); } catch (e) { console.warn('refreshProfile failed', e); }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handlePass = () => {
    const targetUid = profile.uid || profile.id;
    if (!user || !user.uid) {
      navigate('/login', { state: { from: location.pathname, action: 'pass', targetUid } });
      return;
    }
    console.log('Passed profile:', profile.id);
  };

  return (
    <Card
      sx={{
        width: '100%',
        maxWidth: { xs: '100%', sm: 500, md: 600 },
        margin: 'auto',
        mt: 2,
        mb: 2,
        borderRadius: { xs: '8px', sm: '12px' },
        position: 'relative',
      }}
    >
      <CardMedia
        component="img"
        sx={{
          height: { xs: 250, sm: 350, md: 400 },
          objectFit: 'cover',
        }}
        image={profile.image || 'https://via.placeholder.com/600x400'}
        alt={profile.name}
      />
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, position: 'relative' }}>
                {/* Premium Message Button */}
                <Tooltip title="Message" placement="left">
                  <IconButton
                    onClick={() => navigate(`/messagesv2?uid=${profile.uid}`)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
                      color: '#fff',
                      border: '2px solid #FFD700',
                      boxShadow: '0 4px 16px 0 rgba(122,47,255,0.18)',
                      zIndex: 2,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
                        boxShadow: '0 6px 24px 0 rgba(255,215,0,0.18)',
                      },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 26, color: '#FFD700', filter: 'drop-shadow(0 0 6px #7a2fff88)' }} />
                  </IconButton>
                </Tooltip>
        <Typography variant="h5" component="div" sx={{ fontSize: { xs: '1.3rem', sm: '1.5rem' }, mb: 0.5 }}>
          {profile.name} {profile.age ? `, ${profile.age}` : ''}
        </Typography>
        {profile.district && (
          <Typography variant="subtitle2" sx={{ color: '#7a2fff', fontWeight: 600, mb: 1 }}>
            {profile.district}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, mb: 2 }}>
          {profile.bio}
        </Typography>
        {profile.interests && profile.interests.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {profile.interests.map((it, i) => (
              <Chip key={i} label={it} size="small" sx={{ background: 'linear-gradient(135deg,#7a2fff,#ff5fa2)', color: 'white' }} />
            ))}
          </Box>
        )}
        <Grid container spacing={{ xs: 1, sm: 2 }}>
          <Grid item xs={6}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              onClick={handlePass}
              startIcon={<Clear />}
              size="small"
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              id={passBtnId}
            >
              Pass
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              onClick={handleLike}
              startIcon={<Favorite />}
              size="small"
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              id={likeBtnId}
            >
              Like
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;