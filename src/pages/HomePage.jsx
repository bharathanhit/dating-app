import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Grid, Box, Typography, CircularProgress, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ProfileCard from '../components/ProfileCard.jsx';
import SEOHead from '../components/SEOHead.jsx';
import { getAllUserProfiles } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const HomePage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Responsive: enable swipe only on mobile
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Swipe status for each profile (for badge animation)
  const [swipeStatuses, setSwipeStatuses] = useState([]); // array of 'liked' | 'passed' | null

  // Keep swipeStatuses in sync with profiles
  useEffect(() => {
    setSwipeStatuses((prev) => {
      if (profiles.length === prev.length) return prev;
      // Reset or extend statuses to match profiles
      return profiles.map((_, i) => prev[i] || null);
    });
  }, [profiles]);

  useEffect(() => {
    let mounted = true;
    const fetchProfiles = async () => {
      setLoading(true);
      setError('');
      try {
        console.log(`[HomePage] Fetching profiles, current user uid: ${user?.uid || 'not logged in'}`);
        const data = await getAllUserProfiles(user?.uid);
        if (!mounted) return;
        console.log(`[HomePage] Received ${data.length} profiles from service`);
        console.log(`[HomePage] Profile UIDs: ${data.map(p => p.uid).join(', ')}`);
        // Map profiles to include computed fields like age and district
        const mapped = data.map((p) => {
          let birth = null;
          if (p.birthDate) {
            // Firestore may return Timestamp objects
            if (p.birthDate.toDate) birth = p.birthDate.toDate();
            else birth = new Date(p.birthDate);
          }
          const age = birth ? new Date().getFullYear() - birth.getFullYear() : null;

          // Extract district: prefer p.district, then address.district, then parse from location
          let district = null;
          if (p.district) district = p.district;
          else if (p.address && p.address.district) district = p.address.district;
          else if (p.location && typeof p.location === 'string') {
            const parts = p.location.split(',').map((s) => s.trim()).filter(Boolean);
            // If looks like 'District, Tamil Nadu' or 'City, Tamil Nadu'
            if (parts.length >= 2 && /tamil nadu/i.test(parts[parts.length - 1])) {
              district = parts[0];
            }
          }

          return {
            ...p,
            age,
            district: district || p.district || '',
            bio: p.bio || '',
            image: p.image || p.photoURL || 'https://via.placeholder.com/800x600',
          };
        });
        console.log(`[HomePage] Mapped ${mapped.length} profiles for display`);
        setProfiles(mapped);
      } catch (err) {
        console.error('Failed to load profiles', err);
        setError(err.message || 'Failed to load profiles');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfiles();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <>
        <SEOHead
          title="Discover Your Perfect Match | Bichat Dating"
          description="Browse profiles and find your perfect match on Bichat. Connect with singles in your area looking for meaningful relationships."
          keywords="dating profiles, browse singles, find matches, online dating, meet people, Bichat"
          url="https://bichat-make-friendswith-bichat.netlify.app/"
          schema={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Bichat",
            "url": "https://bichat-make-friendswith-bichat.netlify.app/",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://bichat-make-friendswith-bichat.netlify.app/?search={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          }}
        />
        <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 }, mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Container maxWidth={isMobile ? 'sm' : 'lg'} sx={{ pb: { xs: 12, sm: 10 }, minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="error">Error loading profiles</Typography>
            <Typography variant="body2" color="text.secondary">{error}</Typography>
          </Box>
        ) : profiles.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6">No profiles yet</Typography>
            <Typography variant="body2" color="text.secondary">Be the first to complete your profile.</Typography>
          </Box>
        ) : isMobile ? (
          <Box sx={{ width: '100%' }}>
            {/* Mobile: show all cards in a scrollable list, each card is swipeable */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {profiles.map((profile, idx) => (
                <motion.div
                  key={profile.uid}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.8}
                  style={{
                    width: '100%',
                    position: 'relative',
                    background: swipeStatuses[idx] === 'liked'
                      ? 'rgba(0, 255, 0, 0.1)'
                      : swipeStatuses[idx] === 'passed'
                        ? 'rgba(255, 0, 0, 0.1)'
                        : 'transparent',
                    borderRadius: 16,
                    overflow: 'hidden',
                    rotate: swipeStatuses[idx] === 'liked' ? 15 : swipeStatuses[idx] === 'passed' ? -15 : 0,
                  }}
                  whileTap={{ scale: 0.97 }}
                  onDragEnd={(e, info) => {
                    if (!user) {
                      // Reset position if not logged in
                      // We can't easily reset the drag position imperatively with simple framer-motion drag
                      // But we can redirect. The card might stay dragged until unmount or refresh, but redirect happens fast.
                      navigate('/login', { state: { from: location.pathname } });
                      return;
                    }
                    if (info.offset.x > 120) {
                      setSwipeStatuses((prev) => prev.map((s, i) => i === idx ? 'liked' : s));
                      setTimeout(() => {
                        document.getElementById(`like-btn-${profile.uid}`)?.click();
                        setProfiles((prev) => prev.filter((_, i) => i !== idx));
                        setSwipeStatuses((prev) => prev.filter((_, i) => i !== idx));
                      }, 500);
                    } else if (info.offset.x < -120) {
                      setSwipeStatuses((prev) => prev.map((s, i) => i === idx ? 'passed' : s));
                      setTimeout(() => {
                        document.getElementById(`pass-btn-${profile.uid}`)?.click();
                        setProfiles((prev) => prev.filter((_, i) => i !== idx));
                        setSwipeStatuses((prev) => prev.filter((_, i) => i !== idx));
                      }, 500);
                    }
                  }}
                >
                  {/* Animated badge for swipe feedback */}
                  <AnimatePresence>
                    {swipeStatuses[idx] === 'liked' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.7, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.7, y: -30 }}
                        transition={{ duration: 0.4 }}
                        style={{
                          position: 'absolute',
                          top: 24,
                          left: 24,
                          zIndex: 10,
                          background: 'linear-gradient(90deg,#7a2fff,#ff5fa2)',
                          color: 'white',
                          borderRadius: 16,
                          padding: '8px 18px',
                          fontWeight: 700,
                          fontSize: 18,
                          boxShadow: '0 2px 12px #7a2fff44',
                          pointerEvents: 'none',
                        }}
                      >
                        ❤️ Liked
                      </motion.div>
                    )}
                    {swipeStatuses[idx] === 'passed' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.7, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.7, y: -30 }}
                        transition={{ duration: 0.4 }}
                        style={{
                          position: 'absolute',
                          top: 24,
                          right: 24,
                          zIndex: 10,
                          background: 'linear-gradient(90deg,#ff5fa2,#7a2fff)',
                          color: 'white',
                          borderRadius: 16,
                          padding: '8px 18px',
                          fontWeight: 700,
                          fontSize: 18,
                          boxShadow: '0 2px 12px #ff5fa244',
                          pointerEvents: 'none',
                        }}
                      >
                        ❌ Passed
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <ProfileCard
                    profile={profile}
                    likeBtnId={`like-btn-${profile.uid}`}
                    passBtnId={`pass-btn-${profile.uid}`}
                    status={swipeStatuses[idx]} // Pass status to card
                    sx={{
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      border: swipeStatuses[idx] ? '4px solid' : '2px solid',
                      borderColor: swipeStatuses[idx] === 'liked'
                        ? '#00e676' // Solid Green
                        : swipeStatuses[idx] === 'passed'
                          ? '#ff1744' // Solid Red
                          : 'rgba(0,0,0,0.1)',
                      borderRadius: '24px',
                      overflow: 'hidden',
                    }}
                  />
                </motion.div>
              ))}
            </Box>
          </Box>
        ) : (
          <Grid container spacing={2} justifyContent="center">
            {profiles.map((profile) => (
              <Grid item xs={12} sm={6} md={6} lg={4} key={profile.uid}>
                <ProfileCard profile={profile} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </>
  );
};

export default HomePage;
