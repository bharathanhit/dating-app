import { db } from '../config/firebase.js';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, serverTimestamp, arrayUnion, deleteDoc } from 'firebase/firestore';


// Create or update user profile
export const createUserProfile = async (userId, profileData) => {
  try {
    const userDocRef = doc(db, 'users', userId);

    // Normalize birthDate: if it's a Date object, convert to ISO string for portability
    const dataToSave = { ...profileData };
    if (dataToSave.birthDate) {
      if (dataToSave.birthDate.toDate) {
        // Firestore Timestamp -> convert to ISO
        dataToSave.birthDate = dataToSave.birthDate.toDate().toISOString();
      } else if (dataToSave.birthDate instanceof Date) {
        dataToSave.birthDate = dataToSave.birthDate.toISOString();
      } else if (typeof dataToSave.birthDate === 'string') {
        // assume already ISO
      }
    }

    // Always write uid into the document
    dataToSave.uid = userId;

    await setDoc(
      userDocRef,
      {
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

// Get user profile
export const getUserProfile = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};
// Update user profile
export const updateUserProfile = async (userId, profileData) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      ...profileData,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Get all user profiles
export const getAllUserProfiles = async (excludeUid = null) => {
  try {
    const usersCol = collection(db, 'users');
    // Order by createdAt desc
    const q = query(usersCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const profiles = [];
    snapshot.forEach((docSnap) => {
      if (excludeUid && docSnap.id === excludeUid) return;
      profiles.push({ uid: docSnap.id, ...docSnap.data() });
    });
    console.log(`[getAllUserProfiles] Fetched ${profiles.length} profiles (total docs: ${snapshot.size}, excludeUid: ${excludeUid || 'none'})`);
    return profiles;
  } catch (error) {
    console.error('Error fetching all user profiles:', error);
    throw error;
  }
};

// Get users by state name (best-effort). Since schemas vary, this performs a client-side filter.
export const getUsersByState = async (stateName) => {
  try {
    const all = await getAllUserProfiles();
    if (!stateName) return all;

    const normalized = stateName.trim().toLowerCase();
    return all.filter((p) => {
      // try multiple possible fields
      if (!p) return false;
      if (p.state && String(p.state).toLowerCase().includes(normalized)) return true;
      if (p.location && String(p.location).toLowerCase().includes(normalized)) return true;
      // nested address object
      if (p.address && p.address.state && String(p.address.state).toLowerCase().includes(normalized)) return true;
      return false;
    });
  } catch (err) {
    console.error('Error getting users by state:', err);
    throw err;
  }
};

// Return a map of district -> { count, users: [...] } for users in the given state
export const getDistrictCounts = async (stateName) => {
  try {
    const users = await getUsersByState(stateName);
    const map = {};

    users.forEach((p) => {
      let district = null;
      if (p.district) district = String(p.district).trim();
      else if (p.address && p.address.district) district = String(p.address.district).trim();
      else if (p.location) {
        // try to parse district from a comma-separated location like "Chennai, Tamil Nadu"
        const parts = String(p.location).split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) district = parts[0];
      }

      if (!district) district = 'Unknown';

      if (!map[district]) map[district] = { count: 0, users: [] };
      map[district].count += 1;
      map[district].users.push(p);
    });

    return map;
  } catch (err) {
    console.error('Error computing district counts:', err);
    throw err;
  }
};

// Check if user profile is complete
export const isProfileComplete = (profile) => {
  if (!profile) return false;

  const requiredFields = ['name', 'gender', 'lookingFor', 'interests', 'birthDate'];
  return requiredFields.every((field) => profile[field]);
};

// Add a liked profile entry to a user's likedProfiles subcollection
export const addLikedProfile = async (userId, likedProfile) => {
  try {
    const likedProfileRef = doc(collection(db, 'users', userId, 'likedProfiles'), likedProfile.uid);
    // Store only minimal info
    await setDoc(likedProfileRef, {
      uid: likedProfile.uid,
      name: likedProfile.name || '',
      image: likedProfile.image || null,
      createdAt: serverTimestamp(),
    });
    // Optionally, update user's updatedAt
    await updateDoc(doc(db, 'users', userId), { updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error adding liked profile:', error);
    throw error;
  }
};

// Remove a liked profile by uid from user's likedProfiles subcollection
export const removeLikedProfile = async (userId, likedProfileUid) => {
  try {
    const likedProfileRef = doc(collection(db, 'users', userId, 'likedProfiles'), likedProfileUid);
    await deleteDoc(likedProfileRef);
    // Optionally, update user's updatedAt
    await updateDoc(doc(db, 'users', userId), { updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error removing liked profile:', error);
    throw error;
  }
};
// Get all liked profiles for a user from the subcollection
export const getLikedProfiles = async (userId) => {
  try {
    const likedProfilesCol = collection(db, 'users', userId, 'likedProfiles');
    const snapshot = await getDocs(likedProfilesCol);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error fetching liked profiles:', error);
    return [];
  }
};

// Upload a profile image to Firebase Storage and return the download URL
// Upload a profile image to Firebase Storage and return the download URL
// Helper to compress image
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; // Limit width to 500px to keep size small
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Compress to JPEG at 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Process profile image (Compress & Convert to Base64) for Firestore storage
export const uploadProfileImage = async (userId, file, onProgress) => {
  try {
    if (onProgress) onProgress(10);
    
    // Compress and convert to Base64 string
    // We store the image string directly in Firestore since Storage is not available
    const base64Image = await compressImage(file);
    
    if (onProgress) onProgress(100);
    return base64Image;
  } catch (err) {
    console.error('Image processing failed', err);
    throw err;
  }
};





