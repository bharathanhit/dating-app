import { useState, useRef, useEffect } from 'react';
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
  Autocomplete,
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, uploadProfileImage } from '../services/userService';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import SEOHead from '../components/SEOHead.jsx';
import ImageCropper from '../components/ImageCropper';
import { useNavigate } from 'react-router-dom';

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
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Profile Preview
          </Typography>
          {profile.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                📍 {profile.location}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            {profile.bio || 'No bio added yet'}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ProfilePage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', interests: [], location: '' });

  // Gallery management
  // Items: { type: 'url' | 'file', content: string | File, id: string }
  const [galleryItems, setGalleryItems] = useState([]);

  // Cropper state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [tempFile, setTempFile] = useState(null); // To store original file if needed, or just flow it through

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Redirect to onboarding if no profile exists
  useEffect(() => {
    if (!profile && user) {
      navigate('/onboarding', { replace: true });
    }
  }, [profile, user, navigate]);

  // Initialize form from profile when entering edit mode
  const startEdit = () => {
    setForm({
      name: profile?.name || '',
      bio: profile?.bio || '',
      interests: profile?.interests || [],
      location: profile?.location || '',
    });

    // Initialize gallery
    let initialItems = [];
    if (profile?.images && profile.images.length > 0) {
      initialItems = profile.images.map((url, i) => ({ type: 'url', content: url, id: `old-${i}` }));
    } else if (profile?.image || profile?.avatar) {
      initialItems = [{ type: 'url', content: profile.image || profile.avatar, id: 'old-main' }];
    }
    setGalleryItems(initialItems);

    setError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
    setUploadProgress(0);
    setGalleryItems([]);
    setCropModalOpen(false);
    setImageToCrop(null);
  };

  const handleAddPhoto = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // If single file, open cropper
      if (files.length === 1) {
        const file = files[0];
        setTempFile(file);
        setImageToCrop(URL.createObjectURL(file));
        setCropModalOpen(true);
        // Reset input so same file can be selected again if cancelled
        e.target.value = null;
      } else {
        // Multiple files - skip cropper (bulk upload)
        const newItems = Array.from(files).map((file, i) => ({
          type: 'file',
          content: file,
          preview: URL.createObjectURL(file), // for display
          id: `new-${Date.now()}-${i}`
        }));
        setGalleryItems(prev => [...prev, ...newItems]);
        e.target.value = null;
      }
    }
  };

  const handleCropComplete = (croppedBlob) => {
    if (!croppedBlob) {
      setCropModalOpen(false);
      return;
    }

    // Convert blob to file
    const file = new File([croppedBlob], tempFile ? tempFile.name : 'cropped-image.jpg', {
      type: 'image/jpeg',
    });

    const newItem = {
      type: 'file',
      content: file,
      preview: URL.createObjectURL(file),
      id: `new-${Date.now()}-cropped`
    };

    setGalleryItems(prev => [...prev, newItem]);
    setCropModalOpen(false);
    setImageToCrop(null);
    setTempFile(null);
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    setImageToCrop(null);
    setTempFile(null);
  };

  const handleRemovePhoto = (id) => {
    setGalleryItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    if (!user || !user.uid) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Process images
      // 1. Upload new files
      // 2. Collect all URLs
      const finalImageUrls = [];
      const totalNewFiles = galleryItems.filter(item => item.type === 'file').length;
      let processedFiles = 0;

      for (const item of galleryItems) {
        if (item.type === 'url') {
          finalImageUrls.push(item.content);
        } else if (item.type === 'file') {
          try {
            // Update progress based on count
            if (totalNewFiles > 0) {
              const baseProgress = (processedFiles / totalNewFiles) * 100;
              setUploadProgress(baseProgress);
            }

            // Upload
            const url = await uploadProfileImage(user.uid, item.content);
            finalImageUrls.push(url);
            processedFiles++;

          } catch (e) {
            console.error('Failed to upload image file', e);
            // decide whether to fail all or continue? Let's continue but warn? 
            // For now, fail safe
            throw new Error('Failed to upload one or more images');
          }
        }
      }

      setUploadProgress(100);

      const mainImage = finalImageUrls.length > 0 ? finalImageUrls[0] : null;

      await updateUserProfile(user.uid, {
        ...form,
        image: mainImage, // Legacy support
        images: finalImageUrls, // New multi-photo array
        profileComplete: true,
      });

      // Refresh profile in context
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      console.error('Failed to save profile', err);
      let msg = err.message || 'Failed to save profile';
      if (msg.includes('Network Error') || msg.includes('network') || !msg) {
        msg = 'Network error. Check your connection or Firebase Storage rules.';
      }
      setError(msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Don't show "No profile found" - redirect happens in useEffect
  if (!profile) {
    return (
      <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Determine main display image (for view mode)
  const mainDisplayImage = profile.image || profile.avatar || 'https://via.placeholder.com/150';

  return (
    <>
      <SEOHead
        title="My Profile | BiChat Dating"
        description="Manage your BiChat dating profile"
        noindex={true}
      />
      <Container maxWidth="lg" sx={{ pb: { xs: 12, sm: 10 } }}>
        <Card sx={{ mt: 2, mb: 2 }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">

              {/* Left Column: Photos (Edit Mode) or Main Avatar (View Mode) */}
              <Grid item xs={12} md={4} display="flex" flexDirection="column" alignItems="center">

                {!editing ? (
                  // View Mode: Simple Avatar
                  <Avatar
                    src={mainDisplayImage}
                    sx={{
                      width: { xs: 120, md: 160 },
                      height: { xs: 120, md: 160 },
                      mb: 1,
                      border: '4px solid white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                ) : (
                  // Edit Mode: Photo Gallery Grid
                  <Box sx={{ width: '100%', mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Photos ({galleryItems.length}/8)
                    </Typography>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                      {Array.from({ length: 8 }).map((_, index) => {
                        const item = galleryItems[index];
                        if (item) {
                          return (
                            <Box
                              key={item.id}
                              sx={{
                                position: 'relative',
                                aspectRatio: '1/1',
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: index === 0 ? '2px solid #754bffff' : '1px solid #ddd'
                              }}
                            >
                              <img
                                src={item.type === 'file' ? item.preview : item.content}
                                alt={`upload-${index}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              {index === 0 && (
                                <Box sx={{
                                  position: 'absolute', bottom: 0, left: 0, width: '100%',
                                  bgcolor: 'rgba(117, 75, 255, 0.8)', color: 'white',
                                  fontSize: '0.6rem', textAlign: 'center', py: 0.5
                                }}>
                                  Main
                                </Box>
                              )}
                              <Box
                                onClick={() => handleRemovePhoto(item.id)}
                                sx={{
                                  position: 'absolute', top: 2, right: 2,
                                  bgcolor: 'rgba(0,0,0,0.6)', color: 'white',
                                  width: 20, height: 20, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '1rem', lineHeight: 1
                                }}
                              >
                                &times;
                              </Box>
                            </Box>
                          );
                        } else {
                          return (
                            <Box
                              key={`empty-${index}`}
                              onClick={() => galleryInputRef.current?.click()}
                              sx={{
                                aspectRatio: '1/1',
                                borderRadius: 2,
                                border: '2px dashed #ccc',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'text.secondary',
                                bgcolor: '#fafafa',
                                transition: 'all 0.2s',
                                '&:hover': { bgcolor: '#f0f0f0', borderColor: '#999' }
                              }}
                            >
                              <Typography variant="h5" sx={{ color: '#ddd' }}>+</Typography>
                            </Box>
                          );
                        }
                      })}
                    </Box>
                    <input
                      ref={galleryInputRef}
                      accept="image/*"
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleAddPhoto}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', textAlign: 'center' }}>
                      First photo is your main profile picture.
                    </Typography>
                  </Box>
                )}

              </Grid>

              {/* Right Column: Text Fields */}
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
                      <>
                        <TextField
                          label="Full name"
                          fullWidth
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          sx={{ mb: 2 }}
                        />
                        <Autocomplete
                          options={[
                            'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur',
                            'Vellore', 'Thanjavur', 'Thoothukudi', 'Dindigul', 'Erode', 'Kancheepuram',
                            'Tiruvallur', 'Tirunelveli', 'Kanyakumari', 'Nagapattinam', 'Namakkal',
                            'Krishnagiri', 'Pudukkottai', 'Ramanathapuram', 'Sivaganga', 'Villupuram',
                            'Ariyalur', 'Cuddalore', 'Perambalur', 'Chengalpattu', 'Ranipet', 'Tenkasi', 'Mayiladuthurai'
                          ]}
                          value={form.location || null}
                          onChange={(e, val) => setForm((p) => ({ ...p, location: val || '' }))}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Location (Tamil Nadu)"
                              placeholder="Select your district"
                            />
                          )}
                          sx={{ mb: 2 }}
                        />
                      </>
                    )}
                  </Box>

                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => (editing ? cancelEdit() : startEdit())}
                    size="small"
                    sx={{ mt: { xs: 1, sm: 0 } }}
                  >
                    {editing ? 'Cancel' : 'Edit Profile'}
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
                        {loading ? <CircularProgress size={20} /> : 'Save Changes'}
                      </Button>
                      <Button variant="outlined" onClick={cancelEdit} disabled={loading}>Cancel</Button>
                    </Box>
                  ) : null}

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Uploading photos: {Math.round(uploadProgress)}%</Typography>
                      <Box sx={{ width: '100%', height: 4, bgcolor: '#eee', borderRadius: 2 }}>
                        <Box sx={{ width: `${uploadProgress}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 2, transition: 'width 0.3s' }} />
                      </Box>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Image Cropper Dialog */}
        {cropModalOpen && imageToCrop && (
          <ImageCropper
            open={cropModalOpen}
            image={imageToCrop}
            onComplete={handleCropComplete}
            onCancel={handleCropCancel}
            aspectRatio={1}
          />
        )}

      </Container>
    </>
  );
};

export default ProfilePage;