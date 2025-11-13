import { useEffect, useState } from 'react';
import { Container, Grid, Box, Typography, CircularProgress } from '@mui/material';
import ProfileCard from '../components/ProfileCard.jsx';
import { getAllUserProfiles } from '../services/userService';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        setError('Failed to load profiles');
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
      <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 }, mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 } }}>
      <Grid container spacing={2} justifyContent="center">
        {profiles.length === 0 ? (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6">No profiles yet</Typography>
              <Typography variant="body2" color="text.secondary">Be the first to complete your profile.</Typography>
            </Box>
          </Grid>
        ) : (
          profiles.map((profile) => (
            <Grid item xs={12} sm={6} md={6} lg={4} key={profile.uid}>
              <ProfileCard profile={profile} />
            </Grid>
          ))
        )}
      </Grid>
    </Container>
  );
};

export default HomePage;
