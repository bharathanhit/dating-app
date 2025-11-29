# Online Status Feature Documentation

## Overview
The online status feature allows users to see when other users are online or when they were last seen in the conversation/messages page. This feature uses Firebase Realtime Database for real-time updates.

## Features Implemented

### 1. **Online/Offline Status**
- Shows a green dot and "Online" text when a user is active
- Shows "Last seen: [timestamp]" when a user is offline

### 2. **Real-time Updates**
- Status updates in real-time using Firebase Realtime Database listeners
- Automatically sets user to offline when they close the tab/browser

### 3. **Typing Indicators**
- Shows "typing..." animation when the other user is typing
- Automatically clears when user stops typing or sends a message

### 4. **Message Read Receipts**
- Shows "Seen" for messages that have been read
- Shows "Sent" for messages that haven't been read yet

## Technical Implementation

### Database Structure (Firebase Realtime Database)

```
/status
  /{userId}
    online: boolean
    lastSeen: timestamp

/messages
  /{conversationId}
    /{messageId}
      senderId: string
      text: string
      timestamp: number
      seen: boolean

/typing
  /{conversationId}
    /{userId}: boolean
```

### Key Components

#### 1. Status Listener (Receiver's Status)
```javascript
useEffect(() => {
  if (!receiver?.uid) return;
  
  const statusRef = ref(realtimeDb, `status/${receiver.uid}`);
  return onValue(statusRef, snap => {
    setStatus(snap.val());
  });
}, [receiver]);
```

#### 2. Status Broadcaster (Current User's Status)
```javascript
useEffect(() => {
  if (!user?.uid) return;
  
  const myStatusRef = ref(realtimeDb, `status/${user.uid}`);
  
  // Set online
  set(myStatusRef, {
    online: true,
    lastSeen: serverTimestamp(),
  });
  
  // Handle offline on tab close
  const handleOffline = () => {
    update(myStatusRef, {
      online: false,
      lastSeen: serverTimestamp(),
    });
  };
  
  window.addEventListener("beforeunload", handleOffline);
  
  return () => {
    handleOffline();
    window.removeEventListener("beforeunload", handleOffline);
  };
}, [user]);
```

#### 3. Typing Indicator
```javascript
const handleTyping = (e) => {
  if (!activeConv?.id || !typingRef) return;
  
  if (e.target.value.length > 0) {
    if (!typing) {
      set(typingRef, true);
      setTyping(true);
    }
  } else {
    set(typingRef, false);
    setTyping(false);
  }
};
```

## UI Components

### Status Display
- **Online**: Green dot + "Online" text in green
- **Offline**: Gray text showing "Last seen: [date/time]"
- **Typing**: Blue pulsing "typing..." text

### Visual Indicators
```jsx
{status?.online ? (
  <div className="flex items-center gap-2">
    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
    <span className="text-green-500 font-medium text-sm">Online</span>
  </div>
) : (
  <span className="text-gray-500 text-sm">
    Last seen: {status.lastSeen ? new Date(status.lastSeen).toLocaleString() : "—"}
  </span>
)}
```

## Configuration

### Firebase Setup Required
1. **Realtime Database** must be enabled in Firebase Console
2. **Database Rules** should allow authenticated users to read/write their own status:

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
        ".write": "auth != null"
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

## Usage

The `MessagesPage` component expects these props:
- `activeConv`: Object with conversation details (must have `id` property)
- `receiver`: Object with receiver's user details (must have `uid`, `name`, and `photoURL`/`image` properties)

Example:
```jsx
<MessagesPage 
  activeConv={{ id: 'conversation123' }}
  receiver={{ 
    uid: 'user456',
    name: 'John Doe',
    photoURL: 'https://...'
  }}
/>
```

## Features Breakdown

### ✅ Implemented
- [x] Real-time online/offline status
- [x] Last seen timestamp
- [x] Typing indicators
- [x] Message read receipts
- [x] Auto-offline on tab close
- [x] Real-time message sync

### 🔄 Potential Enhancements
- [ ] Show online status in user list/conversation list
- [ ] Add "Active now" for users active in last 5 minutes
- [ ] Add presence for multiple devices
- [ ] Add notification sounds for new messages
- [ ] Add message delivery status (sent, delivered, seen)
- [ ] Add support for image/media messages

## Troubleshooting

### Status not updating?
1. Check Firebase Realtime Database is enabled
2. Verify database rules allow read/write access
3. Check browser console for errors
4. Ensure `realtimeDb` is properly imported from `../config/firebase`

### Typing indicator not working?
1. Verify `activeConv.id` is set correctly
2. Check that both users have valid UIDs
3. Ensure typing refs are not null

### Messages not syncing?
1. Check conversation ID is consistent
2. Verify Firebase Realtime Database connection
3. Check network tab for Firebase requests

## Performance Considerations

- Uses Firebase Realtime Database listeners for efficient real-time updates
- Automatically cleans up listeners on component unmount
- Minimal data transfer with focused database queries
- Typing indicators debounced to reduce writes

## Security Notes

- All status updates require authentication
- Users can only write their own status
- All users can read status (for online presence)
- Message seen status only updates for received messages

## Reusable Hooks and Components

### Custom Hooks

#### `useOnlineStatus(userId)`
Monitor a single user's online status:

```javascript
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const MyComponent = ({ userId }) => {
  const status = useOnlineStatus(userId);
  
  return (
    <div>
      {status?.online ? 'Online' : 'Offline'}
      {status?.lastSeen && <span>Last seen: {new Date(status.lastSeen).toLocaleString()}</span>}
    </div>
  );
};
```

#### `useMultipleOnlineStatuses(userIds)`
Monitor multiple users' online statuses:

```javascript
import { useMultipleOnlineStatuses } from '../hooks/useOnlineStatus';

const UserList = ({ userIds }) => {
  const statuses = useMultipleOnlineStatuses(userIds);
  
  return (
    <div>
      {userIds.map(userId => (
        <div key={userId}>
          {userId}: {statuses[userId]?.online ? 'Online' : 'Offline'}
        </div>
      ))}
    </div>
  );
};
```

#### `useSetOnlineStatus(userId)`
Automatically set current user's online status:

```javascript
import { useSetOnlineStatus } from '../hooks/useOnlineStatus';

const App = () => {
  const { user } = useAuth();
  useSetOnlineStatus(user?.uid);
  
  return <div>Your app content</div>;
};
```

### Components

#### `OnlineStatusIndicator`
A reusable component that shows an avatar with online status badge:

```javascript
import OnlineStatusIndicator from '../components/OnlineStatusIndicator';

const UserProfile = ({ userId, photoURL, name }) => {
  return (
    <OnlineStatusIndicator
      userId={userId}
      src={photoURL}
      alt={name}
      showRipple={true}
      avatarProps={{ sx: { width: 56, height: 56 } }}
    />
  );
};
```

**Props:**
- `userId` (string, required): The user ID to show status for
- `src` (string): Avatar image source
- `alt` (string): Avatar alt text (default: "User avatar")
- `avatarProps` (object): Additional props for the Avatar component
- `showRipple` (boolean): Whether to show animated ripple effect (default: true)

## Files Modified/Created

### Modified Files
1. **`src/pages/MessagesPage.jsx`** - Main messages page with online status
2. **`src/components/ConversationsList.jsx`** - Conversations list with online indicators

### Created Files
1. **`src/hooks/useOnlineStatus.js`** - Custom hooks for online status
2. **`src/components/OnlineStatusIndicator.jsx`** - Reusable status indicator component
3. **`.agent/ONLINE_STATUS_FEATURE.md`** - This documentation file

