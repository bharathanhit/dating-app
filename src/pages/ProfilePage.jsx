import { useState, useRef } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Box,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, uploadProfileImage } from '../services/userService';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import SEOHead from '../components/SEOHead.jsx';

// Helper: convert file to data URL
const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const SwipeableProfileCard = ({ profile, onLike, onPass }) => {
  const x = useMotionValue(0);
  const background = useTransform(x, [-200, 0, 200], ['rgba(255,0,0,0.2)', 'rgba(255,255,255,1)', 'rgba(0,255,0,0.2)']);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      onLike(profile);
    } else if (info.offset.x < -150) {
      onPass(profile);
    }
  };

  return (
    <motion.div
      style={{ x, rotate, background }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 1.1 }}
      className="swipeable-card"
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 400,
          margin: 'auto',
          mt: 2,
          mb: 2,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {profile.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {profile.bio}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ProfilePage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', interests: [], location: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Initialize form from profile when entering edit mode
  const startEdit = () => {
    setForm({
      name: profile?.name || '',
      bio: profile?.bio || '',
      interests: profile?.interests || [],
      location: profile?.location || '',
    });
    setImagePreview(profile?.image || profile?.avatar || null);
    setImageFile(null);
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
    setUploadProgress(0);
  };

  const handleSave = async () => {
    if (!user || !user.uid) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let imageUrl = profile?.image || profile?.avatar || null;
      if (imageFile) {
        try {
          // upload to Firebase Storage and get download URL
          imageUrl = await uploadProfileImage(user.uid, imageFile, (p) => setUploadProgress(p));
        } catch (e) {
          console.error('Failed to upload image file', e);
          throw e;
        }
      }

      await updateUserProfile(user.uid, {
        ...form,
        image: imageUrl,
        profileComplete: true,
      });

      // Refresh profile in context
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      console.error('Failed to save profile', err);
      let msg = err.message || 'Failed to save profile';
      if (msg.includes('Network Error') || msg.includes('network') || !msg) {
        msg = 'Network error. If you are developing locally, this may be a CORS issue with Firebase Storage. Check the console for details.';
      }
      setError(msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleLike = (profile) => {
    console.log('Liked profile:', profile);
    // Add logic to handle liking the profile
  };

  const handlePass = (profile) => {
    console.log('Passed profile:', profile);
    // Add logic to handle passing the profile
  };

  if (!profile) {
    return (
      <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 } }}>
        <Typography variant="h6" sx={{ mt: 4 }}>No profile found.</Typography>
      </Container>
    );
  }

  return (
    <>
      <SEOHead
        title="My Profile | Bichat Dating"
        description="Manage your Bichat dating profile"
        noindex={true}
      />
      <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 } }}>
        <Card sx={{ mt: 2, mb: 2 }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
              <Grid item xs={12} md={4} display="flex" justifyContent="center" flexDirection="column" alignItems="center">
                <Avatar
                  src={imagePreview || profile.image || profile.avatar}
                  sx={{
                    width: { xs: 120, md: 160 },
                    height: { xs: 120, md: 160 },
                    mb: 1,
                  }}
                />

                {editing ? (
                  <>
                    <input
                      ref={fileInputRef}
                      accept="image/*"
                      id="profile-image-input"
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0];
                        if (f) {
                          setImageFile(f);
                          setImagePreview(URL.createObjectURL(f));
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" onClick={() => fileInputRef.current?.click()}>Choose Photo</Button>
                      <Button size="small" onClick={() => { setImageFile(null); setImagePreview(null); }}>Remove</Button>
                    </Box>
                  </>
                ) : null}
              </Grid>

              <Grid item xs={12} md={8}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                  <Box sx={{ width: '100%' }}>
                    {!editing ? (
                      <>
                        <Typography
                          variant="h4"
                          gutterBottom
                          sx={{ fontSize: { xs: '1.5rem', sm: '1.875rem', md: '2.125rem' } }}
                        >
                          {profile.name}
                        </Typography>
                        {profile.location && (
                          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                            {profile.location}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <TextField
                        label="Full name"
                        fullWidth
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        sx={{ mb: 2 }}
                      />
                    )}
                  </Box>

                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => (editing ? cancelEdit() : startEdit())}
                    size="small"
                    sx={{ mt: { xs: 1, sm: 0 } }}
                  >
                    {editing ? 'Cancel' : 'Edit'}
                  </Button>
                </Box>

                <Box sx={{ mt: 2 }}>
                  {!editing ? (
                    <Typography variant="body1" paragraph sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                      {profile.bio}
                    </Typography>
                  ) : (
                    <TextField
                      label="About me"
                      fullWidth
                      multiline
                      minRows={3}
                      value={form.bio}
                      onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                      sx={{ mb: 2 }}
                    />
                  )}

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Interests</Typography>
                    {!editing ? (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {(profile.interests || []).map((interest, i) => (
                          <Chip key={i} label={interest} />
                        ))}
                      </Box>
                    ) : (
                      <TextField
                        label="Interests (comma separated)"
                        fullWidth
                        value={(form.interests || []).join(', ')}
                        onChange={(e) => setForm((p) => ({ ...p, interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        helperText="Separate interests with commas"
                      />
                    )}
                  </Box>

                  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                  {editing ? (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button variant="contained" onClick={handleSave} disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : 'Save'}
                      </Button>
                      <Button variant="outlined" onClick={cancelEdit} disabled={loading}>Cancel</Button>
                    </Box>
                  ) : null}

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Uploading: {uploadProgress}%</Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Swipeable profile card demo */}
        <SwipeableProfileCard
          profile={profile}
          onLike={handleLike}
          onPass={handlePass}
        />
      </Container>
    </>
  );
};

export default ProfilePage;