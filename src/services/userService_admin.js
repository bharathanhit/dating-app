
// Admin function to block/ban a user
export const adminBlockUser = async (userId, reason) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const currentBlockCount = userDoc.data()?.blockCount || 0;
    
    await updateDoc(userRef, {
      isBlocked: true,
      blockReason: reason,
      blockCount: currentBlockCount + 1,
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log(`[adminBlockUser] User ${userId} blocked. Reason: ${reason}`);
    return true;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
};

// Admin function to unblock a user
export const adminUnblockUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      isBlocked: false,
      blockReason: null,
      blockedAt: null,
      updatedAt: serverTimestamp(),
    });
    
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
