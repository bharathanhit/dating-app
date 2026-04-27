import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { ThemeProvider, createTheme, Box, Typography, IconButton, Snackbar, Alert } from '@mui/material';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { ProtectedOnboardingRoute } from './components/ProtectedOnboardingRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import MessagesPageV2 from './pages/MessagesPageV2.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import LikesPage from './pages/LikesPage.jsx';
import WhoLikedMePage from './pages/WhoLikedMePage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import CoinsPage from './pages/CoinsPage.jsx';
import PublicProfilePage from './pages/PublicProfilePage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';
import RefundPolicyPage from './pages/RefundPolicyPage.jsx';
import TermsAndConditionsPage from './pages/TermsAndConditionsPage.jsx';
import AdminUserList from './pages/AdminUserList.jsx';
import GamingArenaHub from './pages/GamingArenaHub.jsx';
import LikeNotification from './components/LikeNotification.jsx';
// import InstallPrompt from './components/InstallPrompt.jsx';
import { useSetOnlineStatus } from './hooks/useOnlineStatus.js';
import { useAuth } from './context/AuthContext.jsx';
import { requestNotificationPermission, onMessageListener } from './services/notificationService.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Chat, Close } from '@mui/icons-material';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#754bffff',
    },
    secondary: {
      main: '#7f0f98ff',
    },
  },
});

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

const AppContent = () => {
  const { user } = useAuth();
  const [notification, setNotification] = useState({ open: false, title: '', body: '' });

  // Set user online status when authenticated
  useSetOnlineStatus(user?.uid);

  // Request notification permission and set up foreground listener
  useEffect(() => {
    if (user?.uid) {
      requestNotificationPermission(user.uid);
      
      const setupListener = async () => {
        const unsubscribe = await onMessageListener((payload) => {
          setNotification({
            open: true,
            title: payload.notification?.title || 'New Message',
            body: payload.notification?.body || ''
          });
        });
        return unsubscribe;
      };

      let unsubscribePromise = setupListener();
      
      return () => {
        unsubscribePromise.then(unsub => unsub && unsub());
      };
    }
  }, [user?.uid]);

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const location = useLocation();
  const isGamesPage = location.pathname === '/games';

  return (
    <>
      {/* Premium In-App Notification (Foreground) */}
      <AnimatePresence>
        {notification.open && (
          <Box
            component={motion.div}
            initial={{ y: -100, opacity: 0, scale: 0.8 }}
            animate={{ y: 20, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.8 }}
            onClick={handleCloseNotification}
            sx={{
              position: 'fixed',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              width: { xs: '90%', sm: '400px' },
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              p: 2,
              borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: '#7a2fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 10px rgba(122, 47, 255, 0.3)',
              }}
            >
              <Chat fontSize="small" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.2 }}>
                {notification.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.2, fontSize: '0.85rem' }}>
                {notification.body}
              </Typography>
            </Box>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCloseNotification(); }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}
      </AnimatePresence>
      <LikeNotification />
      {/* <InstallPrompt /> */}

      <div className={`app ${isGamesPage ? 'games-page-active' : ''}`}>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminUserList />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedOnboardingRoute>
                  <MessagesPageV2 />
                </ProtectedOnboardingRoute>
              }
            />
            <Route
              path="/messagesv2"
              element={
                <ProtectedOnboardingRoute>
                  <MessagesPageV2 />
                </ProtectedOnboardingRoute>
              }
            />
            <Route
              path="/likes"
              element={
                <ProtectedOnboardingRoute>
                  <LikesPage />
                </ProtectedOnboardingRoute>
              }
            />
            <Route
              path="/who-liked-me"
              element={
                <ProtectedOnboardingRoute>
                  <WhoLikedMePage />
                </ProtectedOnboardingRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedOnboardingRoute>
                  <NotificationsPage />
                </ProtectedOnboardingRoute>
              }
            />
            <Route
              path="/coins"
              element={
                <ProtectedOnboardingRoute>
                  <CoinsPage />
                </ProtectedOnboardingRoute>
              }
            />
            <Route path="/profile/:uid" element={<PublicProfilePage />} />
            <Route
              path="/profile"
              element={
                <ProtectedOnboardingRoute>
                  <ProfilePage />
                </ProtectedOnboardingRoute>
              }
            />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/terms" element={<TermsAndConditionsPage />} />
            <Route
              path="/games"
              element={
                <ProtectedOnboardingRoute>
                  <GamingArenaHub />
                </ProtectedOnboardingRoute>
              }
            />

            {/* Catch all for 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {!isGamesPage && <Footer />}
      </div>
    </>
  );
};

export default App;
