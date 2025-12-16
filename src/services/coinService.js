import { db } from '../config/firebase.js';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, limit, getDocs, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';
import { functions } from '../config/firebase.js';
import { httpsCallable } from 'firebase/functions';

/**
 * Get user's current coin balance
 * @param {string} userId - User ID
 * @returns {Promise<number>} Current coin balance
 */
export const getUserCoins = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.coins || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error fetching user coins:', error);
    return 0;
  }
};

/**
 * Add coins to user's balance with transaction logging
 * @param {string} userId - User ID
 * @param {number} amount - Amount of coins to add
 * @param {string} reason - Reason for adding coins (e.g., 'daily_login', 'purchase')
 * @returns {Promise<boolean>} Success status
 */
export const addCoins = async (userId, amount, reason = 'manual') => {
  try {
    const userDocRef = doc(db, 'users', userId);
    
    // Use transaction to ensure atomic update
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const currentCoins = userDoc.data().coins || 0;
      const newBalance = currentCoins + amount;
      
      // Update user's coin balance
      transaction.update(userDocRef, {
        coins: newBalance,
        updatedAt: serverTimestamp()
      });
      
      // Log transaction
      const transactionRef = doc(collection(db, 'users', userId, 'coinTransactions'));
      transaction.set(transactionRef, {
        type: 'credit',
        amount: amount,
        reason: reason,
        balanceBefore: currentCoins,
        balanceAfter: newBalance,
        createdAt: serverTimestamp()
      });
    });
    
    console.log(`[coinService] Added ${amount} coins to user ${userId} (reason: ${reason})`);
    return true;
  } catch (error) {
    console.error('Error adding coins:', error);
    throw error;
  }
};

/**
 * Deduct coins from user's balance with validation
 * @param {string} userId - User ID
 * @param {number} amount - Amount of coins to deduct
 * @param {string} reason - Reason for deducting coins (e.g., 'like', 'message')
 * @returns {Promise<boolean>} Success status
 */
export const deductCoins = async (userId, amount, reason = 'manual') => {
  try {
    const userDocRef = doc(db, 'users', userId);
    
    // Use transaction to ensure atomic update and prevent negative balance
    const result = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const currentCoins = userDoc.data().coins || 0;
      
      // Check if user has enough coins
      if (currentCoins < amount) {
        return { success: false, error: 'Insufficient coins' };
      }
      
      const newBalance = currentCoins - amount;
      
      // Update user's coin balance
      transaction.update(userDocRef, {
        coins: newBalance,
        updatedAt: serverTimestamp()
      });
      
      // Log transaction
      const transactionRef = doc(collection(db, 'users', userId, 'coinTransactions'));
      transaction.set(transactionRef, {
        type: 'debit',
        amount: amount,
        reason: reason,
        balanceBefore: currentCoins,
        balanceAfter: newBalance,
        createdAt: serverTimestamp()
      });
      
      return { success: true };
    });
    
    if (!result.success) {
      console.warn(`[coinService] Failed to deduct coins: ${result.error}`);
      return false;
    }
    
    console.log(`[coinService] Deducted ${amount} coins from user ${userId} (reason: ${reason})`);
    return true;
  } catch (error) {
    console.error('Error deducting coins:', error);
    throw error;
  }
};

/**
 * Check if user is eligible for daily login reward and award if applicable
 * @param {string} userId - User ID
 * @returns {Promise<{awarded: boolean, coins: number}>} Reward status
 */
export const checkDailyLoginReward = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error('[coinService] User not found for daily login reward');
      return { awarded: false, coins: 0 };
    }
    
    const userData = userDoc.data();
    const lastLoginDate = userData.lastLoginDate;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Initialize coins field if it doesn't exist (for existing users)
    if (userData.coins === undefined || userData.coins === null) {
      console.log('[coinService] Initializing coins for existing user');
      await updateDoc(userDocRef, {
        coins: 0,
        lastLoginDate: null,
        updatedAt: serverTimestamp()
      });
    }
    
    // Check if user already logged in today
    if (lastLoginDate === today) {
      console.log('[coinService] User already received daily login reward today');
      return { awarded: false, coins: 0 };
    }
    
    // Award daily login bonus
    // const DAILY_LOGIN_REWARD = 25;
    // await addCoins(userId, DAILY_LOGIN_REWARD, 'daily_login');
    
    // Update last login date (still useful for tracking activity)
    await updateDoc(userDocRef, {
      lastLoginDate: today,
      updatedAt: serverTimestamp()
    });
    
    console.log(`[coinService] Updated last login date for user ${userId} (No daily reward)`);
    return { awarded: false, coins: 0 };
  } catch (error) {
    console.error('Error checking daily login reward:', error);
    return { awarded: false, coins: 0 };
  }
};

/**
 * Get user's coin transaction history
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of transactions to fetch
 * @returns {Promise<Array>} Array of transactions
 * */
export const getCoinTransactions = async (userId, limitCount = 50) => {
  try {
    const transactionsCol = collection(db, 'users', userId, 'coinTransactions');
    const q = query(transactionsCol, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    const transactions = [];
    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching coin transactions:', error);
    return [];
  }
};

/**
 * Subscribe to real-time coin balance updates
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function to receive updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCoins = (userId, callback) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const coins = doc.data().coins || 0;
        callback(coins);
      } else {
        callback(0);
      }
    }, (error) => {
      console.error('Error subscribing to coins:', error);
      callback(0);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up coin subscription:', error);
    return () => {};
  }
};

/**
 * Initialize coins for a new user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export const initializeUserCoins = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      coins: 0,
      lastLoginDate: null,
      updatedAt: serverTimestamp()
    });
    
    console.log(`[coinService] Initialized coins for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error initializing user coins:', error);
    return false;
  }
};

/**
 * Submit payment proof for manual verification
 * @param {string} userId - User ID
 * @param {number} amount - Amount of coins
 * @param {string} packageName - Package name
 * @param {number} price - Price
 * @param {string} packageId - Package ID
 * @param {string} transactionId - User submitted UTR/Reference ID
 * @returns {Promise<object>} Result
 */
export const submitPaymentProof = async (userId, amount, packageName, price, packageId, transactionId) => {
  try {
    const submitProofFn = httpsCallable(functions, 'submitPaymentProof');
    
    // Parse price to number
    const numericPrice = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;

    const result = await submitProofFn({
      amount: amount,
      packageName: packageName,
      price: numericPrice,
      packageId: packageId || `pkg_${amount}_coins`,
      transactionId: transactionId
    });

    console.log(`[coinService] Submitted payment proof for ${transactionId}`);
    return result.data; 
  } catch (error) {
    console.error('Error submitting payment proof:', error);
    throw error;
  }
};

/**
 * Unlock "Who Liked Me" feature for 1 week
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, error?: string}>} Result
 */
export const unlockLikesFeature = async (userId) => {
  try {
    const UNLOCK_COST = 10;
    const DURATION_DAYS = 7;
    
    // Check balance and deduct coins
    const deductionResult = await deductCoins(userId, UNLOCK_COST, 'unlock_likes');
    
    if (!deductionResult) {
      return { success: false, error: 'Insufficient coins' };
    }
    
    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + DURATION_DAYS);
    
    // Update user profile with expiration timestamp
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      likesUnlockExpiresAt: expirationDate.toISOString(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`[coinService] Unlocked likes feature for user ${userId} until ${expirationDate.toISOString()}`);
    return { success: true };
  } catch (error) {
    console.error('Error unlocking likes feature:', error);
    return { success: false, error: error.message };
  }
};
