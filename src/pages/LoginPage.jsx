import { useState, useEffect } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, Alert, Divider } from '@mui/material';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import SEOHead from '../components/SEOHead.jsx';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      await login(email, password);

      // Wait a moment for the auth context to update with profile data
      setTimeout(() => {
        // If there's a redirect location, use it
        if (location.state?.from) {
          navigate(location.state.from);
        } else {
          // Otherwise, redirect to home page (ProtectedOnboardingRoute will handle redirecting to onboarding if needed)
          navigate('/');
        }
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Login to BiChat | Find Your Perfect Match"
        description="Sign in to your BiChat account to browse profiles, chat with matches, and find meaningful connections."
        keywords="login, sign in, dating app login, BiChat login"
        url="https://bi-chat.online/login"
      />
      <Container maxWidth="sm" sx={{ pb: { xs: 12, sm: 10 } }}>
        <Paper
          elevation={3}
          sx={{
            mt: { xs: 4, sm: 8 },
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: { xs: '8px', sm: '12px' },
          }}
        >
          <Typography
            variant="h4"
            align="center"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
          >
            Welcome Back
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Google Sign In Button */}
          <Box sx={{ mb: 3, mt: 3 }}>
            <GoogleSignInButton variant="outlined" fullWidth={true} />
          </Box>

          <Divider sx={{ my: 3 }}>OR</Divider>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <TextField
              fullWidth
              margin="normal"
              label="Email"
              type="email"
              required
              autoComplete="email"
              variant="outlined"
              size="medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                },
              }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              variant="outlined"
              size="medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 3,
                mb: 2,
                py: { xs: 1, sm: 1.5 },
                fontSize: { xs: '0.9rem', sm: '1rem' },
              }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                Don't have an account?{' '}
                <Button
                  component={Link}
                  to="/signup"
                  variant="text"
                  sx={{ textTransform: 'none' }}
                >
                  Sign Up
                </Button>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default LoginPage;