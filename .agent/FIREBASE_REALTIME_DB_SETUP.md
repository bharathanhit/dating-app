# Firebase Realtime Database Setup for Online Status

## Step 1: Enable Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **date-3963e**
3. Click on **Realtime Database** in the left sidebar
4. Click **Create Database** (if not already created)
5. Choose a location (preferably close to your users)
6. Start in **test mode** initially (we'll update rules next)

## Step 2: Configure Database Rules

Go to the **Rules** tab in Realtime Database and replace with these rules:

```json
{
  "rules": {
    "status": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    },
    "messages": {
      "$conversationId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".indexOn": ["timestamp"]
      }
    },
    "typing": {
      "$conversationId": {
        "$uid": {
          ".read": true,
          ".write": "$uid === auth.uid"
        }
      }
    }
  }
}
```

### Rules Explanation

#### Status Rules
```json
"status": {
  "$uid": {
    ".read": true,           // Anyone can read status (for online presence)
    ".write": "$uid === auth.uid"  // Users can only write their own status
  }
}
```

#### Messages Rules
```json
"messages": {
  "$conversationId": {
    ".read": "auth != null",   // Any authenticated user can read
    ".write": "auth != null",  // Any authenticated user can write
    ".indexOn": ["timestamp"]  // Index for sorting by timestamp
  }
}
```

#### Typing Indicator Rules
```json
"typing": {
  "$conversationId": {
    "$uid": {
      ".read": true,           // Anyone can read typing status
      ".write": "$uid === auth.uid"  // Users can only write their own typing status
    }
  }
}
```

## Step 3: Verify Configuration

Your `firebase.js` config should already have the Realtime Database URL:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyADG4gONMt7vfgLllYPBe3LKD9S0xwQzEA",
  authDomain: "date-3963e.firebaseapp.com",
  databaseURL: "https://date-3963e-default-rtdb.firebaseio.com", // ✅ This is required
  projectId: "date-3963e",
  storageBucket: "date-3963e.appspot.com",
  messagingSenderId: "172915248443",
  appId: "1:172915248443:web:aa0bf66ed5e9c8379ffb1e",
  measurementId: "G-MCD9RC9VBP"
};
```

## Step 4: Test the Setup

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Open two browser windows**:
   - Window 1: Login as User A
   - Window 2: Login as User B

3. **Test online status**:
   - In Window 1, navigate to messages
   - In Window 2, navigate to messages
   - You should see User A as "Online" in Window 2
   - Close Window 1 and User A should show "Last seen: [timestamp]" in Window 2

4. **Test typing indicator**:
   - Start typing in Window 1
   - Window 2 should show "typing..." under User A's name

5. **Test message read receipts**:
   - Send a message from Window 1
   - It should show "Sent" initially
   - Open the conversation in Window 2
   - The message should now show "Seen" in Window 1

## Step 5: Monitor Database Activity

1. Go to Firebase Console → Realtime Database → Data tab
2. You should see the following structure:

```
root
├── status
│   ├── user1_uid
│   │   ├── online: true
│   │   └── lastSeen: 1732856400000
│   └── user2_uid
│       ├── online: false
│       └── lastSeen: 1732856300000
├── messages
│   └── conversation_id
│       ├── message1_id
│       │   ├── senderId: "user1_uid"
│       │   ├── text: "Hello!"
│       │   ├── timestamp: 1732856400000
│       │   └── seen: true
│       └── message2_id
│           └── ...
└── typing
    └── conversation_id
        ├── user1_uid: false
        └── user2_uid: true
```

## Troubleshooting

### Issue: "Permission denied" errors

**Solution**: 
- Check that your database rules are published
- Verify user is authenticated (`auth != null`)
- Check browser console for specific error messages

### Issue: Status not updating in real-time

**Solution**:
- Verify `databaseURL` is set in Firebase config
- Check that `realtimeDb` is imported correctly
- Ensure Firebase Realtime Database is enabled in console
- Check browser Network tab for WebSocket connections

### Issue: Old status persists after closing tab

**Solution**:
- The `beforeunload` event should handle this
- If it doesn't work, consider implementing a heartbeat system
- Alternative: Use Firebase's `onDisconnect()` feature

### Issue: Too many simultaneous connections

**Solution**:
- Firebase Realtime Database has connection limits on free tier
- Consider upgrading to Blaze plan for production
- Optimize listeners to only subscribe when needed

## Production Considerations

### 1. Enhanced Security Rules

For production, add more specific rules:

```json
{
  "rules": {
    "status": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid",
        ".validate": "newData.hasChildren(['online', 'lastSeen'])"
      }
    },
    "messages": {
      "$conversationId": {
        ".read": "auth != null && (
          root.child('conversations').child($conversationId).child('participants').child(auth.uid).exists()
        )",
        ".write": "auth != null && (
          root.child('conversations').child($conversationId).child('participants').child(auth.uid).exists()
        )"
      }
    }
  }
}
```

### 2. Implement Heartbeat System

For more reliable online status:

```javascript
// In your app's root component
useEffect(() => {
  if (!user?.uid) return;
  
  const statusRef = ref(realtimeDb, `status/${user.uid}`);
  
  // Update every 30 seconds
  const interval = setInterval(() => {
    update(statusRef, {
      online: true,
      lastSeen: serverTimestamp(),
    });
  }, 30000);
  
  return () => clearInterval(interval);
}, [user]);
```

### 3. Use onDisconnect()

Firebase's built-in offline detection:

```javascript
import { onDisconnect } from 'firebase/database';

const statusRef = ref(realtimeDb, `status/${user.uid}`);

// Set online
set(statusRef, {
  online: true,
  lastSeen: serverTimestamp(),
});

// Automatically set offline when disconnected
onDisconnect(statusRef).update({
  online: false,
  lastSeen: serverTimestamp(),
});
```

## Cost Considerations

### Free Tier Limits (Spark Plan)
- **Simultaneous connections**: 100
- **GB stored**: 1 GB
- **GB downloaded**: 10 GB/month

### Paid Tier (Blaze Plan)
- **Simultaneous connections**: 200,000
- **GB stored**: $5/GB
- **GB downloaded**: $1/GB

For a dating app with moderate usage, you'll likely need the Blaze plan once you have more than 50-100 active users.

## Next Steps

1. ✅ Set up Realtime Database rules
2. ✅ Test online status functionality
3. ✅ Test typing indicators
4. ✅ Test message read receipts
5. 🔄 Consider implementing `onDisconnect()` for production
6. 🔄 Add heartbeat system for more reliable status
7. 🔄 Monitor usage and upgrade plan if needed
