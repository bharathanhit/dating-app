# Online Status - Quick Reference Card

## 🚀 Quick Start

### 1. Import the Hook
```javascript
import { useOnlineStatus } from '../hooks/useOnlineStatus';
```

### 2. Use in Component
```javascript
const status = useOnlineStatus(userId);
// Returns: { online: boolean, lastSeen: timestamp } or null
```

### 3. Display Status
```javascript
{status?.online ? '🟢 Online' : '⚫ Offline'}
```

---

## 📚 Available Hooks

### `useOnlineStatus(userId)`
Monitor a single user's online status.

**Parameters:**
- `userId` (string): User ID to monitor

**Returns:**
- `{ online: boolean, lastSeen: timestamp }` or `null`

**Example:**
```javascript
const UserStatus = ({ userId }) => {
  const status = useOnlineStatus(userId);
  return <div>{status?.online ? 'Online' : 'Offline'}</div>;
};
```

---

### `useMultipleOnlineStatuses(userIds)`
Monitor multiple users' online statuses.

**Parameters:**
- `userIds` (string[]): Array of user IDs to monitor

**Returns:**
- Object mapping `userId` to `{ online: boolean, lastSeen: timestamp }`

**Example:**
```javascript
const UserList = ({ userIds }) => {
  const statuses = useMultipleOnlineStatuses(userIds);
  
  return userIds.map(id => (
    <div key={id}>
      {id}: {statuses[id]?.online ? 'Online' : 'Offline'}
    </div>
  ));
};
```

---

### `useSetOnlineStatus(userId)`
Automatically set current user's online status.

**Parameters:**
- `userId` (string): Current user's ID

**Returns:**
- `void` (no return value)

**Example:**
```javascript
const App = () => {
  const { user } = useAuth();
  useSetOnlineStatus(user?.uid);
  
  return <YourApp />;
};
```

---

## 🎨 Available Components

### `OnlineStatusIndicator`
Avatar with online status badge.

**Props:**
- `userId` (string, required): User ID to show status for
- `src` (string): Avatar image URL
- `alt` (string): Avatar alt text
- `avatarProps` (object): Additional Avatar props
- `showRipple` (boolean): Show animated ripple (default: true)

**Example:**
```javascript
import OnlineStatusIndicator from '../components/OnlineStatusIndicator';

<OnlineStatusIndicator
  userId={user.uid}
  src={user.photoURL}
  alt={user.name}
  showRipple={true}
  avatarProps={{ sx: { width: 64, height: 64 } }}
/>
```

---

## 🔧 Common Patterns

### Pattern 1: Show Online Status in Header
```javascript
const ChatHeader = ({ receiver }) => {
  const status = useOnlineStatus(receiver.uid);
  
  return (
    <div>
      <h2>{receiver.name}</h2>
      {status?.online ? (
        <span className="text-green-500">🟢 Online</span>
      ) : (
        <span className="text-gray-500">
          Last seen: {new Date(status?.lastSeen).toLocaleString()}
        </span>
      )}
    </div>
  );
};
```

---

### Pattern 2: Show Online Count
```javascript
const OnlineCount = ({ userIds }) => {
  const statuses = useMultipleOnlineStatuses(userIds);
  const onlineCount = Object.values(statuses)
    .filter(s => s?.online).length;
  
  return <div>{onlineCount} users online</div>;
};
```

---

### Pattern 3: Filter Online Users
```javascript
const OnlineUsers = ({ users }) => {
  const userIds = users.map(u => u.uid);
  const statuses = useMultipleOnlineStatuses(userIds);
  
  const onlineUsers = users.filter(u => statuses[u.uid]?.online);
  
  return onlineUsers.map(user => <UserCard key={user.uid} user={user} />);
};
```

---

### Pattern 4: Sort by Online Status
```javascript
const UserList = ({ users }) => {
  const userIds = users.map(u => u.uid);
  const statuses = useMultipleOnlineStatuses(userIds);
  
  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = statuses[a.uid]?.online ? 1 : 0;
    const bOnline = statuses[b.uid]?.online ? 1 : 0;
    return bOnline - aOnline; // Online users first
  });
  
  return sortedUsers.map(user => <UserCard key={user.uid} user={user} />);
};
```

---

## 🎯 Database Paths

### Status Path
```
/status/{userId}
  ├── online: boolean
  └── lastSeen: timestamp
```

**Read:**
```javascript
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

const statusRef = ref(realtimeDb, `status/${userId}`);
onValue(statusRef, (snap) => {
  const status = snap.val();
  console.log(status.online, status.lastSeen);
});
```

**Write:**
```javascript
import { ref, set, serverTimestamp } from 'firebase/database';
import { realtimeDb } from '../config/firebase';

const statusRef = ref(realtimeDb, `status/${userId}`);
set(statusRef, {
  online: true,
  lastSeen: serverTimestamp(),
});
```

---

### Messages Path
```
/messages/{conversationId}/{messageId}
  ├── senderId: string
  ├── text: string
  ├── timestamp: number
  └── seen: boolean
```

---

### Typing Path
```
/typing/{conversationId}/{userId}: boolean
```

---

## 🐛 Debugging

### Check if Status is Being Set
```javascript
// In browser console
firebase.database().ref('status').once('value', (snap) => {
  console.log(snap.val());
});
```

### Check Current User's Status
```javascript
// In browser console
const userId = 'YOUR_USER_ID';
firebase.database().ref(`status/${userId}`).on('value', (snap) => {
  console.log('My status:', snap.val());
});
```

### Monitor All Status Changes
```javascript
// In browser console
firebase.database().ref('status').on('value', (snap) => {
  console.log('All statuses:', snap.val());
});
```

---

## ⚠️ Common Issues

### Issue: Status not updating
**Solution:**
```javascript
// Make sure realtimeDb is imported correctly
import { realtimeDb } from '../config/firebase';

// NOT this:
import { db } from '../firebase';
```

---

### Issue: Permission denied
**Solution:**
Check Firebase Realtime Database rules:
```json
{
  "rules": {
    "status": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

### Issue: Memory leak warning
**Solution:**
Always return cleanup function:
```javascript
useEffect(() => {
  const statusRef = ref(realtimeDb, `status/${userId}`);
  const unsubscribe = onValue(statusRef, callback);
  
  return () => unsubscribe(); // ✅ Cleanup
}, [userId]);
```

---

## 📖 Related Files

- **Documentation**: `.agent/ONLINE_STATUS_FEATURE.md`
- **Setup Guide**: `.agent/FIREBASE_REALTIME_DB_SETUP.md`
- **Architecture**: `.agent/ARCHITECTURE_DIAGRAM.md`
- **Summary**: `.agent/ONLINE_STATUS_SUMMARY.md`

---

## 💡 Pro Tips

1. **Always clean up listeners** to prevent memory leaks
2. **Use hooks** instead of direct Firebase calls for better React integration
3. **Check for null** before accessing status properties
4. **Batch status updates** when monitoring many users
5. **Consider caching** for frequently accessed statuses

---

## 🔗 Useful Links

- [Firebase Realtime Database Docs](https://firebase.google.com/docs/database)
- [React Hooks Guide](https://react.dev/reference/react)
- [Firebase Database Rules](https://firebase.google.com/docs/database/security)

---

**Last Updated:** 2025-11-29
**Version:** 1.0.0
