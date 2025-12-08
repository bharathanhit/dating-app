import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import LikeNotification from './components/LikeNotification.jsx';
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
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <ProtectedOnboardingRoute>
                    <OnboardingPage />
                  </ProtectedOnboardingRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesPageV2 />
                </ProtectedRoute>
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
                <ProtectedRoute>
                  <LikesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/who-liked-me"
              element={
                <ProtectedRoute>
                  <WhoLikedMePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coins"
              element={
                <ProtectedRoute>
                  <CoinsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/profile/:uid" element={<PublicProfilePage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/terms" element={<TermsAndConditionsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
