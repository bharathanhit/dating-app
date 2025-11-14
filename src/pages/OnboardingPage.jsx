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
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { createUserProfile } from "../services/userService";
import { motion } from "framer-motion";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import { BirthDatePicker } from "../components/BirthDatePicker";
import romanticLogo from "../assets/dating_logo.png"; // <-- your romantic logo here
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";

const steps = ["Personal Info", "Photo", "Preferences", "Interests", "Confirm"];
const INTERESTS_LIST = [
  "Travel",
  "Sports",
  "Gaming",
  "Music",
  "Art",
  "Movies",
  "Cooking",
  "Reading",
  "Photography",
  "Fitness",
  "Yoga",
  "Meditation",
  "Fashion",
  "Technology",
  "Volunteering",
  "Gardening",
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
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    lookingFor: "",
    interests: [],
    birthDate: "",
    district: "",
  });

  const TAMIL_NADU_DISTRICTS = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Vellore', 'Thanjavur',
    'Thoothukudi', 'Dindigul', 'Erode', 'Kancheepuram', 'Tiruvallur', 'Tirunelveli', 'Kanyakumari',
    'Nagapattinam', 'Namakkal', 'Krishnagiri', 'Pudukkottai', 'Ramanathapuram', 'Sivaganga', 'Villupuram',
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

  const handleLookingForChange = (e) =>
    setFormData((prev) => ({ ...prev, lookingFor: e.target.value }));

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
      case 1: {
        // Photo step is optional — allow users to upload or skip
        break;
      }
      case 2: {
        if (!formData.lookingFor)
          return setError("Please select what you are looking for");
        break;
      }
      case 3: {
        if (formData.interests.length === 0)
          return setError("Please select at least one interest");
        break;
      }
      default:
        break;
    }
    return true;
  };

  // Convert file to data URL
  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

      // Only use the imageUrl provided by the user (no upload)
      const finalImageUrl = imageUrl || null;
      console.log('Saving profile with imageUrl:', finalImageUrl || 'none');
      await createUserProfile(user.uid, {
        ...formData,
        email: user.email,
        profileComplete: true,
        image: finalImageUrl || null,
      });
      console.log('Profile saved successfully');

      // After saving, refresh profile in context so isProfileComplete updates
      try {
        await refreshProfile();
      } catch (refreshErr) {
        console.warn('Profile refresh failed', refreshErr);
      }
      setLoading(false);
      navigate("/profile");
    } catch (err) {
      setError(err.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box
                sx={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))",
                  border: "2px solid rgba(122, 47, 255, 0.3)",
                  borderRadius: 3,
                  p: 3,
                  boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)",
                }}
              >
              <TextField
                fullWidth
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                InputProps={{
                  sx: {
                    borderRadius: 3,
                    backgroundColor: "white",
                  },
                }}
                InputLabelProps={{
                  sx: {
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: "600",
                  },
                }}
              />

              <FormControl component="fieldset">
                <FormLabel
                  component="legend"
                  sx={{
                    mb: 1,
                    color: "#7a2fff",
                    fontWeight: "700",
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "1rem",
                    letterSpacing: "0.3px",
                  }}
                >
                  Gender
                </FormLabel>
                <ToggleButtonGroup
                  color="secondary"
                  value={formData.gender}
                  exclusive
                  onChange={handleGenderChange}
                  fullWidth
                >
                  <ToggleButton
                    value="male"
                    sx={{
                      textTransform: "capitalize",
                      background:
                        formData.gender === "male"
                          ? "linear-gradient(90deg,#8a2be2,#a64bf4)"
                          : "white",
                      color:
                        formData.gender === "male" ? "white" : "#8a2be2",
                    }}
                  >
                    Male
                  </ToggleButton>
                  <ToggleButton
                    value="female"
                    sx={{
                      textTransform: "capitalize",
                      background:
                        formData.gender === "female"
                          ? "linear-gradient(90deg,#ff5fa2,#ff8fcf)"
                          : "white",
                      color:
                        formData.gender === "female" ? "white" : "#ff5fa2",
                    }}
                  >
                    Female
                  </ToggleButton>
                </ToggleButtonGroup>
              </FormControl>

              <Box>
                <BirthDatePicker
                  value={formData.birthDate}
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, birthDate: date }))
                  }
                />
                <Box sx={{ mt: 2 }}>
                  <Autocomplete
                    options={TAMIL_NADU_DISTRICTS}
                    value={formData.district === '' ? null : formData.district}
                    onChange={(e, val) => setFormData((p) => ({ ...p, district: val || '' }))}
                    isOptionEqualToValue={(option, value) => option === value}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="District (Tamil Nadu)"
                        placeholder="Select your district"
                        size="small"
                      />
                    )}
                  />
                </Box>
              </Box>
              </Box>
            </Box>
          </motion.div>
        );

      // Photo step (optional)
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))",
                border: "2px solid rgba(122, 47, 255, 0.3)",
                borderRadius: 3,
                p: 3,
                boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)",
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: 'center'
              }}
            >
              <Typography sx={{ color: '#7a2fff', fontWeight: 700 }}>Add a profile photo (optional)</Typography>

              {imagePreview ? (
                <Box sx={{ width: 160, height: 160, borderRadius: '50%', overflow: 'hidden', mb: 1 }}>
                  <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              ) : (
                <Box sx={{ width: 160, height: 160, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#666' }}>No photo selected</Typography>
                </Box>
              )}

              {imageUploadProgress > 0 && imageUploadProgress < 100 && (
                <Typography variant="caption" sx={{ mt: 1 }}>{`Uploading image: ${imageUploadProgress}%`}</Typography>
              )}

              <input
                accept="image/*"
                id="profile-image-input"
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (f) {
                    setImageFile(f);
                    setImagePreview(URL.createObjectURL(f));
                    setImageUrl('');
                    setError('');
                  }
                }}
              />
              <label htmlFor="profile-image-input">
                <Button component="span" sx={{ borderRadius: 3 }}>
                  Choose Photo
                </Button>
              </label>

              <Typography variant="caption" sx={{ color: '#666', mt: 1 }}>or paste image URL:</Typography>
              <TextField
                fullWidth
                placeholder="https://example.com/image.jpg"
                size="small"
                value={imageUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setImageUrl(url);
                  if (url) {
                    setImagePreview(url);
                    setError('');
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: 2 }
                }}
              />

              <Box sx={{ display: 'flex', gap: 2, mt: 1, width: '100%' }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setImageUrl('');
                    setImagePreview(null);
                    setImageFile(null);
                    setActiveStep((s) => s + 1);
                    setError('');
                  }}
                  sx={{ borderRadius: 3 }}
                >
                  Skip
                </Button>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setActiveStep((s) => s + 1)}
                  sx={{ borderRadius: 3 }}
                >
                  Next
                </Button>
              </Box>
            </Box>
          </motion.div>
        );

      // Preferences (shifted)
      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))",
                border: "2px solid rgba(122, 47, 255, 0.3)",
                borderRadius: 3,
                p: 3,
                boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)",
              }}
            >
            <FormControl component="fieldset" fullWidth>
              <FormLabel
                component="legend"
                sx={{ 
                  mb: 2, 
                  color: "#7a2fff", 
                  fontWeight: "700",
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "1.1rem",
                  letterSpacing: "0.4px",
                }}
              >
                What are you looking for?
              </FormLabel>
              {LOOKING_FOR_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  fullWidth
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      lookingFor: option.value,
                    }))
                  }
                  sx={{
                    mb: 1,
                    borderRadius: 3,
                    background:
                      formData.lookingFor === option.value
                        ? "linear-gradient(90deg,#7a2fff,#ff5fa2)"
                        : "white",
                    color:
                      formData.lookingFor === option.value
                        ? "white"
                        : "#7a2fff",
                  }}
                >
                  {option.label}
                </Button>
              ))}
              <Typography
                sx={{
                  mt: 3,
                  mb: 1,
                  color: "#7a2fff",
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  letterSpacing: "0.4px",
                }}
              >
                Select your interests (at least one)
              </Typography>
              <Autocomplete
                multiple
                options={INTERESTS_LIST}
                value={formData.interests}
                onChange={handleInterestsChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Add interests"
                    placeholder="Search interests"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 3,
                      },
                    }}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option}
                      label={option}
                      sx={{
                        background: "linear-gradient(135deg, #7a2fff, #ff5fa2)",
                        color: "white",
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: "500",
                      }}
                    />
                  ))
                }
              />
            </FormControl>
            </Box>
          </motion.div>
        );

  // Case 4: Confirmation
  case 4:
        return (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 255, 0.95))",
                border: "2px solid rgba(122, 47, 255, 0.3)",
                borderRadius: 3,
                p: 3,
                boxShadow: "0 4px 20px rgba(122, 47, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Typography 
                variant="h6"
                sx={{
                  color: "#2c0276ff",
                
                  fontWeight: "700",
                  fontSize: "1.2rem",
                  letterSpacing: "0.5px",
                }}
              >
                Review Your Profile
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: "rgba(122, 47, 255, 0.08)",
                  borderRadius: 3,
                  border: "2px solid rgba(122, 47, 255, 0.2)",
                }}
              >
                <Typography 
                  variant="body2"
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: "600",
                    mb: 1,
                    color: "#333",
                  }}
                >
                  <strong>Name:</strong> {formData.name}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: "600",
                    mb: 1,
                    color: "#333",
                  }}
                >
                  <strong>Gender:</strong> {formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1)}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: "600",
                    mb: 1,
                    color: "#333",
                  }}
                >
                  <strong>Birth Date:</strong> {formData.birthDate ? formData.birthDate.toLocaleDateString() : "Not selected"}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: "600",
                    mb: 1,
                    color: "#333",
                  }}
                >
                  <strong>Looking for:</strong> {LOOKING_FOR_OPTIONS.find(o => o.value === formData.lookingFor)?.label || "Not selected"}
                </Typography>
                <Typography 
                  variant="body2"
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: "600",
                    mb: 1,
                    color: "#333",
                  }}
                >
                  <strong>Interests:</strong>
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                  {formData.interests.map((interest) => (
                    <Chip
                      key={interest}
                      label={interest}
                      size="small"
                      sx={{
                        background: "linear-gradient(135deg, #7a2fff, #ff5fa2)",
                        color: "white",
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: "500",
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Typography 
                variant="body2" 
                color="textSecondary" 
                sx={{
                  mt: 2,
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: "500",
                  fontSize: "0.9rem",
                  fontStyle: "italic",
                }}
              >
                You can edit these details later in your profile page.
              </Typography>
            </Box>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100vh",
        py: 4,
        background:
          "linear-gradient(135deg, #e6d6ff 0%, #fbd6ff 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <img
          src={romanticLogo}
          alt="Dating Logo"
          style={{ width: 70, marginBottom: 10 }}
        />
        <Typography
          variant="h4"
          sx={{
            
            fontWeight: 600,
            fontSize: "2rem",
            color: "#340e76ff",
            letterSpacing: "0.5px",
            textShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          Complete Your Profile
        </Typography>
        <Typography 
          variant="body2" 
          color="textSecondary"
          sx={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            fontSize: "0.95rem",
            letterSpacing: "0.3px",
          }}
        >
          Help us get to know you better
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>{renderStepContent()}</Box>

      {activeStep !== 1 && (
        <Box sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
        <Button
          disabled={activeStep === 0 || loading}
          onClick={handleBack}
          variant="outlined"
          sx={{ 
            borderRadius: 3, 
            color: "#7a2fff", 
            borderColor: "#7a2fff",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: "600",
          }}
        >
          Back
        </Button>

        {activeStep === steps.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant="contained"
            sx={{
              borderRadius: 3,
              flex: 1,
              background: "linear-gradient(135deg, #7a2fff, #ff5fa2)",
              color: "white",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: "700",
            }}
          >
            {loading ? <CircularProgress size={24} /> : "Complete Profile"}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{
              borderRadius: 3,
              flex: 1,
              background: "linear-gradient(135deg, #7a2fff, #ff5fa2)",
              color: "white",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: "700",
            }}
          >
            Next
          </Button>
        )}
        </Box>
      )}
    </Container>
  );
}
