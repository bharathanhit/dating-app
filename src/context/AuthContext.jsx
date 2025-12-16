import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { getUserProfile } from '../services/userService.js';
import { subscribeToCoins, checkDailyLoginReward } from '../services/coinService.js';
import { subscribeToLikedBy } from '../services/userService.js';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [coins, setCoins] = useState(0);
  // Initialize likeCount from localStorage to prevent flicker
  const [likeCount, setLikeCount] = useState(() => {
    try {
      const saved = localStorage.getItem('likeCount');
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen for auth state changes and fetch profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Fetch user profile from Firestore if user exists
      if (currentUser) {
        try {
          const userProfile = await getUserProfile(currentUser.uid);
          setProfile(userProfile || null);

          // Check and award daily login reward
          const rewardResult = await checkDailyLoginReward(currentUser.uid);
          if (rewardResult.awarded) {
            console.log(`[AuthContext] Awarded ${rewardResult.coins} coins for daily login`);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
        setCoins(0);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Subscribe to real-time coin balance updates
  useEffect(() => {
    let unsubscribeCoins = () => { };

    if (user?.uid) {
      unsubscribeCoins = subscribeToCoins(user.uid, (newCoins) => {
        setCoins(newCoins);
      });
    }

    return () => {
      unsubscribeCoins();
    };
  }, [user?.uid]);

  // Subscribe to likedBy to get like count
  useEffect(() => {
    let unsubscribeLikes = () => { };

    if (user?.uid) {
      unsubscribeLikes = subscribeToLikedBy(user.uid, (profiles) => {
        const count = profiles.length;
        setLikeCount(count);
        // Persist to localStorage
        try {
          localStorage.setItem('likeCount', count.toString());
        } catch (e) {
          console.error('Failed to save like count', e);
        }
      });
    }

    return () => {
      unsubscribeLikes();
    };
  }, [user?.uid]);


  // Helper to refresh profile from Firestore (useful after onboarding)
  const refreshProfile = async () => {
    if (!user || !user.uid) return null;
    try {
      const userProfile = await getUserProfile(user.uid);
      setProfile(userProfile || null);
      return userProfile;
    } catch (err) {
      console.error('Error refreshing profile:', err);
      return null;
    }
  };

  // Sign Up with Email and Password
  const signup = async (email, password) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Sign In with Email and Password
  const login = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Sign In with Google
  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      // Force account selection to allow users to switch accounts
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      provider.addScope('profile');
      provider.addScope('email');
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Sign Out
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get Auth Token
  const getToken = async () => {
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  const value = {
    user,
    profile,
    coins,
    likeCount,
    loading,
    error,
    signup,
    login,
    signInWithGoogle,
    logout,
    getToken,
    refreshProfile,
    isAuthenticated: !!user,
    // Check if profile is complete by verifying required fields exist
    isProfileComplete: profile?.profileComplete === true ||
      (profile?.name && profile?.gender && profile?.lookingFor && profile?.birthDate),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook to use Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
