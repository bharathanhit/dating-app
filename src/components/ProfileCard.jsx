import { Card, CardContent, CardMedia, Typography, Button, Grid, Box, Chip, Avatar, IconButton, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { Favorite, Clear } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { addLikedProfile, removeLikedProfile, hasEverLikedProfile } from '../services/userService';
import { deductCoins, getUserCoins } from '../services/coinService';
import { useNavigate, useLocation } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import { useState, useEffect } from 'react';
import { Alert, Snackbar } from '@mui/material';

const ProfileCard = ({ profile, likeBtnId, passBtnId, status, sx }) => {

  const { user, refreshProfile, profile: myProfile, coins } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [interactionStatus, setInteractionStatus] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const effectiveStatus = status || interactionStatus;

  // Determine images to display: prefer profile.images array, fallback to single profile.image
  const images = (profile.images && profile.images.length > 0)
    ? profile.images
    : [profile.image || 'https://via.placeholder.com/600x800'];

  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Reset image index when profile changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [profile.uid, profile.id]);

  // Check if already liked on mount to set initial status
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (user?.uid && (profile.uid || profile.id)) {
        try {
          const liked = await hasEverLikedProfile(user.uid, profile.uid || profile.id);
          if (liked) {
            setInteractionStatus('liked');
          }
        } catch (error) {
          console.error('Error checking like status:', error);
        }
      }
    };

    checkLikeStatus();
  }, [user?.uid, profile.uid, profile.id]);

  useEffect(() => {
    if (!profile?.uid) return;
    const statusRef = ref(realtimeDb, `status/${profile.uid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      setIsOnline(data?.online || false);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

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
        // remove like (no coin refund)
        await removeLikedProfile(user.uid, likedUid);
        setSnackbar({ open: true, message: 'Removed like', severity: 'info' });
        setInteractionStatus(null);
      } else {
        // Check if this is a completely new like (never liked before)
        const LIKE_COST = 1;
        const hasLikedBefore = await hasEverLikedProfile(user.uid, likedUid);

        // Only deduct coins if this is a brand new like
        if (!hasLikedBefore) {
          const currentCoins = await getUserCoins(user.uid);

          if (currentCoins < LIKE_COST) {
            setSnackbar({
              open: true,
              message: 'Insufficient coins! Purchase more coins to continue liking profiles.',
              severity: 'error'
            });
            // Navigate to coins page after a short delay
            setTimeout(() => {
              navigate('/coins');
            }, 2000);
            return;
          }

          // Deduct coins for new like
          const deducted = await deductCoins(user.uid, LIKE_COST, 'like');

          if (!deducted) {
            setSnackbar({
              open: true,
              message: 'Failed to deduct coins. Please try again.',
              severity: 'error'
            });
            return;
          }
        }

        // add minimal info
        const likedEntry = { uid: likedUid, name: profile.name || '', image: images[0] || null };
        await addLikedProfile(user.uid, likedEntry);
        setInteractionStatus('liked');

        if (hasLikedBefore) {
          setSnackbar({ open: true, message: 'Liked again! (No coins deducted)', severity: 'success' });
        } else {
          setSnackbar({ open: true, message: `Liked! (${LIKE_COST} coin deducted)`, severity: 'success' });
        }
      }

      // refresh context profile so footer updates
      try { await refreshProfile(); } catch (e) { console.warn('refreshProfile failed', e); }
    } catch (err) {
      console.error('Error toggling like:', err);
      setSnackbar({ open: true, message: 'Error processing like. Please try again.', severity: 'error' });
    }
  };

  const handlePass = () => {
    const targetUid = profile.uid || profile.id;
    if (!user || !user.uid) {
      navigate('/login', { state: { from: location.pathname, action: 'pass', targetUid } });
      return;
    }
    setInteractionStatus('passed');
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
        borderRadius: { xs: '20px', sm: '24px' },
        position: 'relative',
        height: { xs: '60vh', sm: 520 }, // Reduced height
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        border: effectiveStatus ? '4px solid' : '2px solid',
        borderColor: effectiveStatus === 'liked'
          ? '#00e676'
          : effectiveStatus === 'passed'
            ? '#ff1744'
            : 'transparent',
        transition: 'border-color 0.3s ease',
        ...sx
      }}
    >
      {/* Image Indicators */}
      {images.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 0,
            width: '100%',
            px: 1,
            display: 'flex',
            gap: 0.5,
            zIndex: 3,
          }}
        >
          {images.map((_, index) => (
            <Box
              key={index}
              sx={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                bgcolor: index === currentImageIndex ? 'white' : 'rgba(255,255,255,0.4)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </Box>
      )}

      {/* Navigation Touch Zones */}
      {images.length > 1 && (
        <>
          {/* Left Zone (Previous) */}
          <Box
            onClick={handlePrevImage}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '30%',
              height: '100%',
              zIndex: 1,
              cursor: 'pointer',
              // debug: border: '1px solid red'
            }}
          />
          {/* Right Zone (Next) */}
          <Box
            onClick={handleNextImage}
            sx={{
              position: 'absolute',
              top: 0,
              left: '30%',
              width: '70%',
              height: '100%',
              zIndex: 1,
              cursor: 'pointer',
              // debug: border: '1px solid blue'
            }}
          />
        </>
      )}

      {/* Full Height Image */}
      <CardMedia
        component="img"
        sx={{
          height: '100%',
          width: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0,
          transition: 'opacity 0.2s ease-in-out', // Smooth transition
        }}
        image={images[currentImageIndex]}
        alt={`${profile.name} - photo ${currentImageIndex + 1}`}
      // loading="lazy" // Removed lazy loading for instant swaps on carousel
      />

      {/* Online Status */}
      {isOnline && (
        <Box
          sx={{
            position: 'absolute',
            top: 24, // pushed down slightly to clear indicators
            left: 16,
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: '#00e676',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 2,
          }}
        />
      )}

      {/* Premium Message Button */}
      <Tooltip title="Message" placement="left">
        <IconButton
          onClick={(e) => {
            e.stopPropagation(); // Prevent navigation
            if (!user) {
              navigate('/login', { state: { from: location.pathname } });
              return;
            }
            const targetUid = profile.uid || profile.id;
            navigate(`/messagesv2?uid=${targetUid}`);
          }}
          sx={{
            position: 'absolute',
            top: 24, // aligned with online status logic
            right: 16,
            background: 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
            color: '#fff',
            border: '2px solid #FFD700',
            boxShadow: '0 4px 16px 0 rgba(122,47,255,0.18)',
            zIndex: 4, // Higher than nav overlay
            width: 48,
            height: 48,
            '&:hover': {
              background: 'linear-gradient(135deg, #FFD700 0%, #7a2fff 60%, #ff5fa2 100%)',
              boxShadow: '0 6px 24px 0 rgba(255,215,0,0.18)',
            },
          }}
        >
          <SendIcon sx={{ fontSize: 24, color: '#FFD700' }} />
        </IconButton>
      </Tooltip>

      {/* Overlay Content Gradient */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 35%, rgba(0,0,0,0) 100%)',
          pt: 11,
          pb: 2,
          px: 2.5,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 2, // layered above nav overlay
          pointerEvents: 'none', // Allow clicks to pass through to images for navigation where empty
        }}
      >
        <Box> {/* pointerEvents inherited as none from parent, allows clicking text to navigate */}
          <Typography variant="h5" component="div" sx={{ fontWeight: 700, color: 'white', mb: 0.25, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {profile.name} {profile.age && <span style={{ fontSize: '0.85em', fontWeight: 400, opacity: 0.9 }}>{profile.age}</span>}
          </Typography>

          {profile.district && (
            <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9, fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              📍 {profile.district}
            </Typography>
          )}

          <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 1.5, lineHeight: 1.4, fontSize: '0.875rem' }}>
            {profile.bio}
          </Typography>

          {profile.interests && profile.interests.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              {profile.interests.map((it, i) => (
                <Chip
                  key={i}
                  label={it}
                  size="small"
                  sx={{
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 5, mt: 1, pointerEvents: 'auto' }}>
          <IconButton
            onClick={(e) => { e.stopPropagation(); handlePass(); }}
            id={passBtnId}
            sx={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #ff4b1f 0%, #ff9068 100%)',
              color: 'white',
              boxShadow: effectiveStatus === 'passed' ? '0 6px 20px rgba(255, 75, 31, 0.8)' : '0 4px 15px rgba(255, 75, 31, 0.4)',
              transform: effectiveStatus === 'passed' ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s',
              border: effectiveStatus === 'passed' ? '3px solid #ff0000' : '2px solid rgba(255,255,255,0.2)',
              '&:hover': {
                transform: 'scale(1.1)',
                background: 'linear-gradient(135deg, #ff4b1f 0%, #ff9068 100%)',
                boxShadow: '0 6px 20px rgba(255, 75, 31, 0.6)',
              },
            }}
          >
            <Clear sx={{ fontSize: 32 }} />
          </IconButton>

          <IconButton
            onClick={(e) => { e.stopPropagation(); handleLike(); }}
            id={likeBtnId}
            sx={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: 'white',
              boxShadow: effectiveStatus === 'liked' ? '0 6px 20px rgba(17, 153, 142, 0.8)' : '0 4px 15px rgba(17, 153, 142, 0.4)',
              transform: effectiveStatus === 'liked' ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s',
              border: effectiveStatus === 'liked' ? '3px solid #00e676' : '2px solid rgba(255,255,255,0.2)',
              '&:hover': {
                transform: 'scale(1.1)',
                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                boxShadow: '0 6px 20px rgba(17, 153, 142, 0.6)',
              },
            }}
          >
            <Favorite sx={{ fontSize: 32 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default ProfileCard;



