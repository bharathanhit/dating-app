import { db } from '../config/firebase.js';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { storage } from '../config/firebase.js';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

// Add a liked profile entry to a user's document (stores minimal info)
export const addLikedProfile = async (userId, likedProfile) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    // Use arrayUnion to add the liked profile object (no duplication control)
    await updateDoc(userDocRef, {
      likedProfiles: arrayUnion(likedProfile),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error adding liked profile:', error);
    throw error;
  }
};

// Remove a liked profile by uid from user's likedProfiles array
export const removeLikedProfile = async (userId, likedProfileUid) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    // We cannot easily remove by matching object unless we know the exact object stored.
    // For simplicity, fetch the document, filter client-side, and write back the array.
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) return false;
    const data = userDoc.data() || {};
    const current = Array.isArray(data.likedProfiles) ? data.likedProfiles : [];
    const filtered = current.filter((p) => p.uid !== likedProfileUid);
    await updateDoc(userDocRef, { likedProfiles: filtered, updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error removing liked profile:', error);
    throw error;
  }
};

// Upload a profile image to Firebase Storage and return the download URL
export const uploadProfileImage = (userId, file, onProgress) => {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = Date.now();
      const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-\_]/g, '_') : 'image';
      const path = `profiles/${userId}/${timestamp}_${safeName}`;
      const storageReference = storageRef(storage, path);

      const uploadTask = uploadBytesResumable(storageReference, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress && typeof onProgress === 'function') onProgress(percent);
        },
        (error) => {
          console.error('Upload failed', error);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    } catch (err) {
      reject(err);
    }
  });
};
