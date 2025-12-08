import { useState } from "react";
import {
  Container,
  Box,
  TextField,
  FormControl,
  FormLabel,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
  Typography,
  Stepper,
  Step,
  StepLabel,
  IconButton,
} from "@mui/material";
import { Delete, AddCircle } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { createUserProfile, uploadProfileImage } from "../services/userService";
import { motion } from "framer-motion";
import "react-datepicker/dist/react-datepicker.css";
import { BirthDatePicker } from "../components/BirthDatePicker";
import romanticLogo from "../assets/dating_logo.png";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";
import ImageCropper from "../components/ImageCropper";

const steps = ["Personal Info", "Photos", "Preferences", "Bio", "Review & Confirm"];
const INTERESTS_LIST = [
  "Travel", "Sports", "Gaming", "Music", "Art", "Movies",
  "Cooking", "Reading", "Photography", "Fitness", "Yoga",
  "Meditation", "Fashion", "Technology", "Volunteering", "Gardening",
];
const LOOKING_FOR_OPTIONS = [
  { label: "Relationship", value: "relationship" },
  { label: "Dating", value: "dating" },
  { label: "Casual", value: "casual" },
  { label: "Friends", value: "friends" },
];

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  // Multi-image state
  const [imageFiles, setImageFiles] = useState([]); // Array of File objects
  const [imagePreviews, setImagePreviews] = useState([]); // Array of blob URLs
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  // Cropper State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempCropImage, setTempCropImage] = useState(null);
  const [originalFileName, setOriginalFileName] = useState('profile-image.jpg');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    lookingFor: "",
    interests: [],
    birthDate: "",
    district: "",
    bio: "",
  });

  const TAMIL_NADU_DISTRICTS = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur',
    'Vellore', 'Thanjavur', 'Thoothukudi', 'Dindigul', 'Erode', 'Kancheepuram',
    'Tiruvallur', 'Tirunelveli', 'Kanyakumari', 'Nagapattinam', 'Namakkal',
    'Krishnagiri', 'Pudukkottai', 'Ramanathapuram', 'Sivaganga', 'Villupuram',
    'Ariyalur', 'Cuddalore', 'Perambalur', 'Chengalpattu', 'Ranipet', 'Tenkasi', 'Mayiladuthurai'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleGenderChange = (e, newGender) => {
    if (newGender !== null)
      setFormData((prev) => ({ ...prev, gender: newGender }));
  };

  const handleInterestsChange = (event, newValue) =>
    setFormData((prev) => ({ ...prev, interests: newValue }));

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0: {
        if (!formData.name.trim()) return setError("Please enter your name");
        if (!formData.gender) return setError("Please select your gender");
        if (!formData.birthDate) return setError("Please select your birth date");
        const age = new Date().getFullYear() - formData.birthDate.getFullYear();
        if (age < 18) return setError("You must be at least 18 years old");
        break;
      }
      case 1:
        break;
      case 2: {
        if (!formData.lookingFor)
          return setError("Please select what you are looking for");
        if (formData.interests.length === 0)
          return setError("Please select at least one interest");
        break;
      }
      case 3:
        break;
      default:
        break;
    }
    return true;
  };

  const handleNext = () => validateCurrentStep() && setActiveStep((s) => s + 1);
  const handleBack = () => {
    setActiveStep((s) => s - 1);
    setError("");
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    setLoading(true);
    setError("");
    try {
      if (!user || !user.uid) throw new Error("User not authenticated");

      let finalImageUrls = [];
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          // Update progress roughly
          setImageUploadProgress(Math.round(((i + 1) / imageFiles.length) * 100));
          const base64 = await uploadProfileImage(user.uid, imageFiles[i]);
          finalImageUrls.push(base64);
        }
      }

      await createUserProfile(user.uid, {
        ...formData,
        email: user.email,
        profileComplete: true,
        image: finalImageUrls.length > 0 ? finalImageUrls[0] : null,
        images: finalImageUrls,
      });

      await refreshProfile();
      setLoading(false);
      navigate("/profile");
    } catch (err) {
      setError(err.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      setOriginalFileName(f.name);
      setTempCropImage(URL.createObjectURL(f));
      setCropModalOpen(true);
      // Reset input value to allow re-selection
      e.target.value = null;
    }
  };

  const handleCropComplete = (croppedBlob) => {
    if (!croppedBlob) {
      setCropModalOpen(false);
      return;
    }
    const file = new File([croppedBlob], originalFileName, { type: "image/jpeg" });
    setImageFiles(prev => [...prev, file]);
    setImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
    setCropModalOpen(false);
    setTempCropImage(null);
  };

  const handleRemoveImage = (index) => {
    const newFiles = [...imageFiles];
    const newPreviews = [...imagePreviews];
    // Revoke URL to avoid memory leak
    URL.revokeObjectURL(newPreviews[index]);
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    setTempCropImage(null);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))", border: "2px solid rgba(122, 47, 255, 0.3)", borderRadius: 3, p: 3, boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)" }}>
                <TextField fullWidth label="Full Name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter your full name" sx={{ mb: 2 }} />
                <FormControl component="fieldset" sx={{ mb: 2 }}>
                  <FormLabel sx={{ mb: 1, color: "#7a2fff", fontWeight: "700" }}>Gender</FormLabel>
                  <ToggleButtonGroup color="secondary" value={formData.gender} exclusive onChange={handleGenderChange} fullWidth>
                    <ToggleButton value="male">Male</ToggleButton>
                    <ToggleButton value="female">Female</ToggleButton>
                  </ToggleButtonGroup>
                </FormControl>
                <BirthDatePicker value={formData.birthDate} onChange={(date) => setFormData((prev) => ({ ...prev, birthDate: date }))} />
                <Box sx={{ mt: 2 }}>
                  <Autocomplete options={TAMIL_NADU_DISTRICTS} value={formData.district === '' ? null : formData.district} onChange={(e, val) => setFormData((p) => ({ ...p, district: val || '' }))} renderInput={(params) => <TextField {...params} label="District (Tamil Nadu)" placeholder="Select your district" size="small" />} />
                </Box>
              </Box>
            </Box>
          </motion.div>
        );

      case 1:
        return (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box sx={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))", border: "2px solid rgba(122, 47, 255, 0.3)", borderRadius: 3, p: 3, boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)", display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <Typography sx={{ color: '#7a2fff', fontWeight: 700 }}>Add your photos (Max 8)</Typography>

              {/* Photos Carousel */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  width: '100%',
                  py: 2,
                  px: 1,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: 3 },
                  '&::-webkit-scrollbar-thumb': { background: '#c4a6fb', borderRadius: 3 },
                }}
              >
                {imagePreviews.map((src, index) => (
                  <Box key={index} sx={{ position: 'relative', flexShrink: 0 }}>
                    <Box sx={{ width: 140, height: 180, borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <img src={src} alt={`profile-${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveImage(index)}
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        background: 'rgba(255,255,255,0.9)',
                        color: '#ff4444',
                        '&:hover': { background: '#fff' }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                    {index === 0 && (
                      <Chip
                        label="Main"
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 5,
                          left: 5,
                          background: 'rgba(122, 47, 255, 0.9)',
                          color: 'white',
                          fontSize: '0.65rem'
                        }}
                      />
                    )}
                  </Box>
                ))}

                {/* Add Button */}
                {imagePreviews.length < 8 && (
                  <Box sx={{ flexShrink: 0 }}>
                    <input accept="image/*" id="profile-image-input" type="file" style={{ display: 'none' }} onChange={handleFileChange} />
                    <label htmlFor="profile-image-input">
                      <Box
                        sx={{
                          width: 140,
                          height: 180,
                          borderRadius: 3,
                          border: '2px dashed #c4a6fb',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { background: 'rgba(122, 47, 255, 0.05)', borderColor: '#7a2fff' }
                        }}
                      >
                        <AddCircle sx={{ fontSize: 40, color: '#c4a6fb', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#7a2fff', fontWeight: 600 }}>Add Photo</Typography>
                      </Box>
                    </label>
                  </Box>
                )}
              </Box>

              {imageUploadProgress > 0 && imageUploadProgress < 100 && (
                <Typography variant="caption">{`Uploading: ${imageUploadProgress}%`}</Typography>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 1, width: '100%' }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setActiveStep((s) => s + 1)}
                  disabled={imagePreviews.length === 0}
                  sx={{ borderRadius: 3, background: imagePreviews.length > 0 ? "linear-gradient(135deg, #7a2fff, #ff5fa2)" : "#e0e0e0" }}
                >
                  {imagePreviews.length > 0 ? "Next" : "Add at least 1 photo"}
                </Button>
              </Box>
            </Box>
          </motion.div>
        );

      case 2:
        return (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box sx={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))", border: "2px solid rgba(122, 47, 255, 0.3)", borderRadius: 3, p: 3, boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)" }}>
              <FormControl component="fieldset" fullWidth>
                <FormLabel sx={{ mb: 2, color: "#7a2fff", fontWeight: "700" }}>What are you looking for?</FormLabel>
                {LOOKING_FOR_OPTIONS.map((option) => (
                  <Button key={option.value} fullWidth onClick={() => setFormData((prev) => ({ ...prev, lookingFor: option.value }))} sx={{ mb: 1, borderRadius: 3, background: formData.lookingFor === option.value ? "linear-gradient(90deg,#7a2fff,#ff5fa2)" : "white", color: formData.lookingFor === option.value ? "white" : "#7a2fff" }}>{option.label}</Button>
                ))}
                <Typography sx={{ mt: 3, mb: 1, color: "#7a2fff", fontWeight: "700" }}>Select your interests (at least one)</Typography>
                <Autocomplete multiple options={INTERESTS_LIST} value={formData.interests} onChange={handleInterestsChange} renderInput={(params) => <TextField {...params} label="Add interests" placeholder="Search interests" />} renderTags={(value, getTagProps) => value.map((option, index) => <Chip {...getTagProps({ index })} key={option} label={option} sx={{ background: "linear-gradient(135deg, #7a2fff, #ff5fa2)", color: "white" }} />)} />
              </FormControl>
            </Box>
          </motion.div>
        );

      case 3:
        return (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box sx={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))", border: "2px solid rgba(122, 47, 255, 0.3)", borderRadius: 3, p: 3, boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)" }}>
              <Typography variant="h6" sx={{ color: "#2c0276ff", fontWeight: "700", mb: 2 }}>Tell us about yourself</Typography>
              <TextField fullWidth multiline rows={4} placeholder="Write a short bio about yourself..." value={formData.bio} onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))} />
            </Box>
          </motion.div>
        );

      case 4:
        return (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Box sx={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))", border: "2px solid rgba(122, 47, 255, 0.3)", borderRadius: 3, p: 3, boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)" }}>
              <Typography variant="h6" sx={{ color: "#2c0276ff", fontWeight: "700", mb: 2 }}>Review Your Profile</Typography>
              <Box sx={{ p: 2, bgcolor: "rgba(122, 47, 255, 0.08)", borderRadius: 3, border: "2px solid rgba(122, 47, 255, 0.2)" }}>
                <Typography variant="body2" sx={{ mb: 1 }}><strong>Name:</strong> {formData.name}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}><strong>Gender:</strong> {formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1)}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}><strong>Birth Date:</strong> {formData.birthDate ? formData.birthDate.toLocaleDateString() : "Not selected"}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}><strong>Looking for:</strong> {LOOKING_FOR_OPTIONS.find(o => o.value === formData.lookingFor)?.label || "Not selected"}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}><strong>Interests:</strong></Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                  {formData.interests.map((interest) => <Chip key={interest} label={interest} size="small" sx={{ background: "linear-gradient(135deg, #7a2fff, #ff5fa2)", color: "white" }} />)}
                </Box>
                <Typography variant="body2" sx={{ mt: 2 }}><strong>Bio:</strong> {formData.bio || "Not provided"}</Typography>
              </Box>
            </Box>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="sm" sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", py: 4, background: "linear-gradient(135deg, #e6d6ff 0%, #fbd6ff 100%)" }}>
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <img src={romanticLogo} alt="Dating Logo" style={{ width: 70, marginBottom: 10 }} loading="lazy" />
        <Typography variant="h4" sx={{ fontWeight: 600, fontSize: "2rem", color: "#340e76ff" }}>Complete Your Profile</Typography>
        <Typography variant="body2" color="textSecondary">Help us get to know you better</Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 4 }}>{renderStepContent()}</Box>

      {activeStep !== 1 && (
        <Box sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
          <Button disabled={activeStep === 0 || loading} onClick={handleBack} variant="outlined" sx={{ borderRadius: 3, color: "#7a2fff", borderColor: "#7a2fff" }}>Back</Button>
          {activeStep === steps.length - 1 ? (
            <Button onClick={handleSubmit} disabled={loading} variant="contained" sx={{ borderRadius: 3, flex: 1, background: "linear-gradient(135deg, #7a2fff, #ff5fa2)", color: "white" }}>{loading ? <CircularProgress size={24} /> : "Complete Profile"}</Button>
          ) : (
            <Button onClick={handleNext} variant="contained" sx={{ borderRadius: 3, flex: 1, background: "linear-gradient(135deg, #7a2fff, #ff5fa2)", color: "white" }}>Next</Button>
          )}
        </Box>
      )}

      {/* Image Cropper */}
      {cropModalOpen && tempCropImage && (
        <ImageCropper
          open={cropModalOpen}
          image={tempCropImage}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
        />
      )}
    </Container>
  );
}