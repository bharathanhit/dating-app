import { db } from '../config/firebase.js';
import { realtimeDb } from '../config/firebase.js';
import { ref, get } from 'firebase/database';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, serverTimestamp, arrayUnion, deleteDoc, onSnapshot, addDoc } from 'firebase/firestore';


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
        coins: 20, // Initialize with 20 coins for new users
        lastLoginDate: null, // Track last login for daily rewards
        // Moderation tracking
        isBlocked: false, // Whether user is currently blocked/banned
        blockReason: null, // Reason for block if blocked
        blockCount: 0, // Number of times user has been blocked
        reportCount: 0, // Number of times user has been reported
        blockedAt: null, // Timestamp of when user was blocked
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
    // Order by createdAt desc - REMOVED temporarily to debug guest access
    // const q = query(usersCol, orderBy('createdAt', 'desc'));
    const q = query(usersCol);
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

    // ALSO add to the target user's "likedBy" subcollection so they know they were liked
    const likedByRef = doc(collection(db, 'users', likedProfile.uid, 'likedBy'), userId);
    console.log(`[addLikedProfile] Adding to likedBy: path=users/${likedProfile.uid}/likedBy/${userId}`);
    
    await setDoc(likedByRef, {
      uid: userId,
      createdAt: serverTimestamp(),
      // We can add a "viewed" flag for notifications
      viewed: false
    });
    console.log(`[addLikedProfile] Successfully added to likedBy`);

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

    // ALSO remove from the target user's "likedBy" subcollection
    const likedByRef = doc(collection(db, 'users', likedProfileUid, 'likedBy'), userId);
    await deleteDoc(likedByRef);

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

// Check if user has ever liked a specific profile
export const hasEverLikedProfile = async (userId, targetUid) => {
  try {
    const likedProfilesCol = collection(db, 'users', userId, 'likedProfiles');
    const q = query(likedProfilesCol, where('uid', '==', targetUid));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking if profile was liked:', error);
    return false;
  }
};

// Get profiles who liked the current user
export const getLikedByProfiles = async (userId) => {
  try {
    console.log(`[getLikedByProfiles] Fetching for user ${userId}`);
    const likedByCol = collection(db, 'users', userId, 'likedBy');
    const snapshot = await getDocs(likedByCol);
    
    console.log(`[getLikedByProfiles] Found ${snapshot.size} docs in likedBy`);
    
    // The likedBy docs might only contain { uid, createdAt }. 
    // We need to fetch the full profiles for these users to display them.
    const likedByData = snapshot.docs.map(doc => doc.data());
    
    if (likedByData.length === 0) return [];

    // Fetch full profiles
    // Ideally use a "where in" query if list is small, or individual fetches.
    // "where in" supports up to 10. Let's do individual fetches for now or Promise.all
    const profiles = await Promise.all(likedByData.map(async (item) => {
      try {
        const profile = await getUserProfile(item.uid);
        return { ...profile, likedAt: item.createdAt };
      } catch (e) {
        console.error(`Failed to fetch profile for ${item.uid}`, e);
        return null;
      }
    }));

    return profiles.filter(p => p !== null);
  } catch (error) {
    console.error('Error fetching likedBy profiles:', error);
    return [];
  }
};

// Subscribe to profiles who liked the current user (Real-time)
export const subscribeToLikedBy = (userId, callback) => {
  try {
    const likedByCol = collection(db, 'users', userId, 'likedBy');
    // Listen for changes
    const unsubscribe = onSnapshot(likedByCol, async (snapshot) => {
      const likedByData = snapshot.docs.map(doc => doc.data());
      
      if (likedByData.length === 0) {
        callback([]);
        return;
      }

      // Fetch full profiles
      // Note: This might trigger multiple fetches if many updates happen. 
      // For a production app, we might want to cache profiles or only fetch new ones.
      const profiles = await Promise.all(likedByData.map(async (item) => {
        try {
          const profile = await getUserProfile(item.uid);
          return { ...profile, likedAt: item.createdAt };
        } catch (e) {
          console.error(`Failed to fetch profile for ${item.uid}`, e);
          return null;
        }
      }));

      callback(profiles.filter(p => p !== null));
    }, (error) => {
      console.error('Error subscribing to likedBy:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up likedBy subscription:', error);
    return () => {};
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

// Get a random user for random chat feature
export const getRandomUser = async (currentUserId) => {
  try {
    console.log(`[getRandomUser] Finding random online user for ${currentUserId}`);
    
    // Get all users except the current user
    const allProfiles = await getAllUserProfiles(currentUserId);
    
    if (allProfiles.length === 0) {
      console.log('[getRandomUser] No other users available');
      return null;
    }
    
    // Get online user IDs
    const onlineUserIds = await getOnlineUsers();
    console.log(`[getRandomUser] Found ${onlineUserIds.length} online users:`, onlineUserIds);
    
    // Filter profiles to only include online users
    const onlineProfiles = allProfiles.filter(profile => 
      onlineUserIds.includes(profile.uid)
    );
    
    console.log(`[getRandomUser] ${onlineProfiles.length} online users available for random chat`);
    
    if (onlineProfiles.length === 0) {
      console.log('[getRandomUser] No online users available');
      return null;
    }
    
    // Select a random user from the online profiles
    const randomIndex = Math.floor(Math.random() * onlineProfiles.length);
    const randomUser = onlineProfiles[randomIndex];
    
    console.log(`[getRandomUser] Selected random online user: ${randomUser.uid}`);
    return randomUser;
  } catch (error) {
    console.error('Error getting random user:', error);
    throw error;
  }
};

// Get list of online user IDs from Realtime Database
const getOnlineUsers = async () => {
  try {
    const statusRef = ref(realtimeDb, 'status');
    const snapshot = await get(statusRef);
    
    if (!snapshot.exists()) {
      console.log('[getOnlineUsers] No status data found');
      return [];
    }
    
    const statusData = snapshot.val();
    const onlineUserIds = [];
    
    // Filter users where online === true
    Object.keys(statusData).forEach(userId => {
      if (statusData[userId]?.online === true) {
        onlineUserIds.push(userId);
      }
    });
    
    return onlineUserIds;
  } catch (error) {
    console.error('Error getting online users:', error);
    return [];
  }
};

// Helper function to create warning notifications based on threshold
const createWarningNotification = async (userId, type, count, severity) => {
  try {
    const notificationsCol = collection(db, 'users', userId, 'notifications');
    
    let title, message, emoji;
    
    if (severity === 'warning') {
      emoji = '⚠️';
      if (type === 'report') {
        title = 'Multiple Reports Received';
        message = `You have been reported by multiple users (${count} reports) for violating community guidelines.\n\nContinued violations may result in:\n• Temporary account suspension\n• Permanent ban from Bichat\n\nPlease review our Terms and Conditions.`;
      } else {
        title = 'Multiple Users Have Blocked You';
        message = `Multiple users (${count}) have blocked you. This may indicate behavior that violates our community guidelines.\n\nPlease ensure you:\n• Respect other users\n• Follow community guidelines\n• Maintain appropriate conduct\n\nContinued issues may result in account restrictions.`;
      }
    } else if (severity === 'severe') {
      emoji = '🚨';
      title = 'Serious Warning';
      if (type === 'report') {
        message = `Your account has received ${count} reports from other users. This is a serious violation of our community guidelines.\n\nImmediate action required:\n• Review our Terms and Conditions\n• Correct your behavior\n• Respect community standards\n\nFailure to comply will result in account suspension.`;
      } else {
        message = `${count} users have blocked you. This indicates serious concerns about your behavior on Bichat.\n\nYour account is under review. Please:\n• Review our community guidelines\n• Ensure respectful interactions\n• Maintain appropriate conduct\n\nFurther violations will result in permanent ban.`;
      }
    } else { // critical
      emoji = '🔴';
      title = 'Final Warning - Account at Risk';
      if (type === 'report') {
        message = `FINAL WARNING: Your account has received ${count} reports. This is your last warning before permanent account suspension.\n\n⚠️ IMMEDIATE ACTION REQUIRED ⚠️\n\nYour account will be permanently banned if you:\n• Receive any additional reports\n• Continue violating guidelines\n• Fail to comply with our Terms\n\nThis is your final opportunity to correct your behavior.`;
      } else {
        message = `FINAL WARNING: ${count} users have blocked you. Your account is at immediate risk of permanent suspension.\n\n⚠️ CRITICAL STATUS ⚠️\n\nYour account will be permanently banned if:\n• More users block you\n• You continue inappropriate behavior\n• You violate community guidelines\n\nThis is your last warning.`;
      }
    }
    
    const notificationData = {
      type: `${type}_warning`,
      title: `${emoji} ${title}`,
      message,
      severity,
      count,
      read: false,
      createdAt: serverTimestamp(),
    };
    
    await addDoc(notificationsCol, notificationData);
    console.log(`[createWarningNotification] Created ${severity} ${type} notification for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[createWarningNotification] Failed to create notification:', error);
    throw error;
  }
};

// Block a user by adding to blockedUsers subcollection
export const blockUser = async (userId, blockedUserId) => {
  try {
    console.log(`[blockUser] User ${userId} blocking ${blockedUserId}`);
    
    // Step 1: Add to blocker's blockedUsers subcollection
    const blockedUserRef = doc(collection(db, 'users', userId, 'blockedUsers'), blockedUserId);
    await setDoc(blockedUserRef, {
      uid: blockedUserId,
      blockedAt: serverTimestamp(),
    });
    console.log(`[blockUser] ✓ Added to blocker's blockedUsers list`);
    
    // Step 2: Create block record in top-level blocks collection for admin review
    try {
      const blocksCol = collection(db, 'blocks');
      await addDoc(blocksCol, {
        blockerId: userId,
        blockedUserId: blockedUserId,
        timestamp: serverTimestamp(),
      });
      console.log(`[blockUser] ✓ Block record created in blocks collection`);
    } catch (error) {
      console.error('[blockUser] ✗ Failed to create block record:', error);
      // Don't throw - this shouldn't block the main operation
    }
    
    // Step 3: Increment blockCount on the blocked user's profile
    try {
      const blockedUserDocRef = doc(db, 'users', blockedUserId);
      const blockedUserDoc = await getDoc(blockedUserDocRef);
      
      if (blockedUserDoc.exists()) {
        const currentBlockCount = blockedUserDoc.data()?.blockCount || 0;
        const newBlockCount = currentBlockCount + 1;
        
        await updateDoc(blockedUserDocRef, {
          blockCount: newBlockCount,
          updatedAt: serverTimestamp(),
        });
        console.log(`[blockUser] ✓ Block count incremented for ${blockedUserId} (now ${newBlockCount})`);
        
        // Step 4: Check threshold and send notification if needed
        const BLOCK_THRESHOLD = 5;
        const SEVERE_THRESHOLD = 10;
        
        if (newBlockCount === BLOCK_THRESHOLD) {
          // First warning at 5 blocks
          await createWarningNotification(blockedUserId, 'block', newBlockCount, 'warning');
          console.log(`[blockUser] ✓ Warning notification sent (${newBlockCount} blocks)`);
        } else if (newBlockCount === SEVERE_THRESHOLD) {
          // Severe warning at 10 blocks
          await createWarningNotification(blockedUserId, 'block', newBlockCount, 'severe');
          console.log(`[blockUser] ✓ Severe warning notification sent (${newBlockCount} blocks)`);
        } else if (newBlockCount > SEVERE_THRESHOLD && newBlockCount % 5 === 0) {
          // Additional warnings every 5 blocks after 10
          await createWarningNotification(blockedUserId, 'block', newBlockCount, 'critical');
          console.log(`[blockUser] ✓ Critical warning notification sent (${newBlockCount} blocks)`);
        }
      }
    } catch (error) {
      console.error('[blockUser] ✗ Failed to update block count:', error);
      // Don't throw - the block itself succeeded
    }
    
    return true;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
};

// Unblock a user by removing from blockedUsers subcollection
export const unblockUser = async (userId, blockedUserId) => {
  try {
    const blockedUserRef = doc(collection(db, 'users', userId, 'blockedUsers'), blockedUserId);
    await deleteDoc(blockedUserRef);
    console.log(`[unblockUser] User ${blockedUserId} unblocked by ${userId}`);
    return true;
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
};

// Get list of blocked user IDs for a user
export const getBlockedUsers = async (userId) => {
  try {
    const blockedUsersCol = collection(db, 'users', userId, 'blockedUsers');
    const snapshot = await getDocs(blockedUsersCol);
    const blockedUserIds = snapshot.docs.map(doc => doc.data().uid);
    console.log(`[getBlockedUsers] User ${userId} has blocked ${blockedUserIds.length} users`);
    return blockedUserIds;
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return [];
  }
};

// Check if a specific user is blocked
export const isUserBlocked = async (userId, targetUserId) => {
  try {
    const blockedUserRef = doc(collection(db, 'users', userId, 'blockedUsers'), targetUserId);
    const docSnap = await getDoc(blockedUserRef);
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking if user is blocked:', error);
    return false;
  }
};

// Report a user - stores report in top-level 'reports' collection
export const reportUser = async (reporterId, reportedUserId, category, reason = '') => {
  try {
    console.log(`[reportUser] Starting report: ${reporterId} reporting ${reportedUserId} for ${category}`);
    
    // Step 1: Create the report document
    const reportsCol = collection(db, 'reports');
    const reportData = {
      reporterId,
      reportedUserId,
      category,
      reason,
      timestamp: serverTimestamp(),
      status: 'pending', // pending, reviewed, resolved
    };
    
    let reportDoc;
    try {
      reportDoc = await addDoc(reportsCol, reportData);
      console.log(`[reportUser] ✓ Report document created: ${reportDoc.id}`);
    } catch (error) {
      console.error('[reportUser] ✗ Failed to create report document:', error);
      throw new Error(`Failed to create report: ${error.message}`);
    }
    
    // Step 2: Increment report count for the reported user
    try {
      const reportedUserRef = doc(db, 'users', reportedUserId);
      const reportedUserDoc = await getDoc(reportedUserRef);
      
      if (!reportedUserDoc.exists()) {
        console.warn(`[reportUser] User ${reportedUserId} document doesn't exist, skipping count update`);
      } else {
        const currentReportCount = reportedUserDoc.data()?.reportCount || 0;
        const newReportCount = currentReportCount + 1;
        
        await updateDoc(reportedUserRef, {
          reportCount: newReportCount,
          updatedAt: serverTimestamp(),
        });
        console.log(`[reportUser] ✓ Report count incremented for user ${reportedUserId} (now ${newReportCount})`);
        
        // Step 3: Check threshold and send notification if needed
        const REPORT_THRESHOLD = 3;
        const SEVERE_THRESHOLD = 10;
        const CRITICAL_THRESHOLD = 20;
        
        if (newReportCount === REPORT_THRESHOLD) {
          // First warning at 3 reports
          await createWarningNotification(reportedUserId, 'report', newReportCount, 'warning');
          console.log(`[reportUser] ✓ Warning notification sent (${newReportCount} reports)`);
        } else if (newReportCount === SEVERE_THRESHOLD) {
          // Severe warning at 10 reports
          await createWarningNotification(reportedUserId, 'report', newReportCount, 'severe');
          console.log(`[reportUser] ✓ Severe warning notification sent (${newReportCount} reports)`);
        } else if (newReportCount >= CRITICAL_THRESHOLD && newReportCount % 5 === 0) {
          // Critical warnings every 5 reports after 20
          await createWarningNotification(reportedUserId, 'report', newReportCount, 'critical');
          console.log(`[reportUser] ✓ Critical warning notification sent (${newReportCount} reports)`);
        } else {
          console.log(`[reportUser] No notification sent (count: ${newReportCount}, thresholds: ${REPORT_THRESHOLD}, ${SEVERE_THRESHOLD}, ${CRITICAL_THRESHOLD})`);
        }
      }
    } catch (error) {
      console.error('[reportUser] ✗ Failed to update report count:', error);
      // Don't throw - report creation succeeded
      console.warn('[reportUser] Continuing despite count update failure');
    }
    
    console.log(`[reportUser] ✓ Report submission completed successfully`);
    return true;
  } catch (error) {
    console.error('[reportUser] ✗ Report submission failed:', error);
    throw error;
  }
};




// Get unread notifications count for a user
export const getUnreadNotificationsCount = async (userId) => {
  try {
    const notificationsCol = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsCol, where('read', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
};

// Get all notifications for a user
export const getUserNotifications = async (userId) => {
  try {
    const notificationsCol = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

// Mark notification as read
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Subscribe to unread notifications count (real-time)
export const subscribeToUnreadNotifications = (userId, callback) => {
  try {
    const notificationsCol = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsCol, where('read', '==', false));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      callback(snapshot.size);
    }, (error) => {
      console.error('Error subscribing to unread notifications:', error);
      callback(0);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up notifications subscription:', error);
    return () => {};
  }
};
