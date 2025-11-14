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
import PublicProfilePage from './pages/PublicProfilePage.jsx';
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
                  path="/likes"
                  element={
                    <ProtectedOnboardingRoute>
                      <LikesPage />
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
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
