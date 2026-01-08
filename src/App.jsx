import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
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
import LikeNotification from './components/LikeNotification.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { useSetOnlineStatus } from './hooks/useOnlineStatus.js';
import { useAuth } from './context/AuthContext.jsx';
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
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

const AppContent = () => {
  const { user } = useAuth();

  // Set user online status when authenticated
  useSetOnlineStatus(user?.uid);

  return (
    <Router>
      <LikeNotification />
      <InstallPrompt />
      <div className="app">
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

            {/* Catch all for 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
