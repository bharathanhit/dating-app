import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
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
    let unsubscribeProfile = () => { };

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[AuthContext] onAuthStateChanged:', currentUser ? `User: ${currentUser.uid}` : 'No user');

      // Prevent routes from rendering before we have profile data
      setLoading(true);
      setUser(currentUser);

      // Clean up previous profile listener if it exists
      unsubscribeProfile();

      // Fetch user profile from Firestore if user exists
      if (currentUser) {
        // PRE-FILL: Set a temporary profile from Google data instantly
        // This ensures isProfileComplete is true for Google users from the very first frame
        setProfile({
          uid: currentUser.uid,
          name: currentUser.displayName || "",
          email: currentUser.email || "",
          ...(profile || {}) // Preserve existing fields if they were already there
        });

        try {
          // Check and award daily login reward
          const rewardResult = await checkDailyLoginReward(currentUser.uid);
          if (rewardResult.awarded) {
            console.log(`[AuthContext] Awarded ${rewardResult.coins} coins for daily login`);
          }

          // Use real-time listener for profile to avoid race conditions
          unsubscribeProfile = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              
              // AUTO-FIX: If Firestore doc is missing basic info but Google has it, sync it now
              if (!data.name && currentUser.displayName) {
                console.log('[AuthContext] syncing Google display name to missing Firestore profile');
                try {
                  const { updateDoc } = await import('firebase/firestore');
                  await updateDoc(doc(db, 'users', currentUser.uid), {
                    name: currentUser.displayName,
                    email: currentUser.email,
                    updatedAt: new Date().toISOString()
                  });
                  // Note: listener will fire again with the new name
                } catch (e) {
                  console.warn('Failed to auto-sync Google name:', e);
                }
              }
              
              console.log('[AuthContext] Profile update received:', data.name || 'No name');
              setProfile(data);
            } else {
              console.log('[AuthContext] Profile document does not exist yet. Creating basic profile if Google user...');
              
              // AUTO-CREATE: For new Google users, create the basic profile and coins instantly
              if (currentUser.displayName) {
                 try {
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(doc(db, 'users', currentUser.uid), {
                      uid: currentUser.uid,
                      name: currentUser.displayName,
                      email: currentUser.email,
                      coins: 25,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    }, { merge: true });
                 } catch (e) {
                   console.warn('Failed to auto-create Google profile:', e);
                 }
              }
              setProfile(null);
            }
            setLoading(false);
          }, (err) => {
            console.error('Error in profile listener:', err);
            setLoading(false);
          });

        } catch (err) {
          console.error('Error initializing user profile:', err);
          setProfile(null);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
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
    // Very resilient logic: Anyone in the database with a name OR email is allowed in.
    // This solves the 'Trapped in Onboarding' issue for Google and legacy accounts.
    isProfileComplete: !!profile?.name || !!profile?.email,
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
