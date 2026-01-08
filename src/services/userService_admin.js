
import { db } from '../config/firebase.js';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Admin function to block/ban a user
export const adminBlockUser = async (userId, reason) => {
  console.log(`[adminBlockUser] Starting block for user: ${userId} with reason: ${reason}`);
  try {
    const userRef = doc(db, 'users', userId);
    console.log('[adminBlockUser] Fetching user doc...');
    const userDoc = await getDoc(userRef);
    
    // Even if doc doesn't exist, we might want to create a placeholder or error out.
    // Assuming user must exist:
    if (!userDoc.exists()) {
       console.error('[adminBlockUser] User not found!');
       throw new Error('User not found');
    }
    
    const currentData = userDoc.data();
    console.log('[adminBlockUser] User found:', currentData);
    const currentBlockCount = currentData?.blockCount || 0;
    
    console.log('[adminBlockUser] Setting document with merge...');
    // Use setDoc with merge to force fields to be written even if they don't exist
    await setDoc(userRef, {
      isBlocked: true,
      blockReason: reason,
      blockCount: currentBlockCount + 1,
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log(`[adminBlockUser] User ${userId} blocked successfully. Reason: ${reason}`);
    return true;
  } catch (error) {
    console.error('[adminBlockUser] Error blocking user:', error);
    throw error;
  }
};

// Admin function to unblock a user
export const adminUnblockUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await setDoc(userRef, {
      isBlocked: false,
      blockReason: null,
      blockedAt: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log(`[adminUnblockUser] User ${userId} unblocked`);
    return true;
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
};

// Get user moderation stats
export const getUserModerationStats = async (userId) => {
  try {
  getUserModerationStats
     const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const data = userDoc.data();
    return {
      isBlocked: data.isBlocked || false,
      blockReason: data.blockReason || null,
      blockCount: data.blockCount || 0,
      reportCount: data.reportCount || 0,
      blockedAt: data.blockedAt || null,
    };
  } catch (error) {
    console.error('Error getting moderation stats:', error);
    return null;
  }
};

















