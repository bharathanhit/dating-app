 # Firestore Security Rules Setup

## Issue
Messages are not sending because Firestore security rules are preventing writes to the `conversations` collection.

## Solution - TEMPORARY (for testing)

Go to **Firebase Console** → Your Project → **Firestore Database** → **Rules** tab and replace the content with:

**TEMPORARY RULES (allow authenticated users to do everything):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads/writes for authenticated users (TEMPORARY FOR TESTING ONLY)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Then **test if messages send now**. If they do, we know the rules were the issue and we can apply stricter rules.

---

## Solution - PRODUCTION (strict & secure)

Once messages work with temporary rules, replace them with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user document
    // AND allow PUBLIC read access to all user profiles (for Home page)
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Conversations: read/write if you're a participant
    match /conversations/{conversationId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      allow create: if request.auth != null;
      
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      // Messages in conversations
      match /messages/{messageId} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        
        allow create: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
  }
}
```

## Steps
1. Go to https://console.firebase.google.com/
2. Select your project "date-3963e"
3. Click "Firestore Database" in left sidebar
4. Click "Rules" tab at the top
5. **Delete** all existing rules
6. **Paste** the TEMPORARY rules above
7. Click **"Publish"** button
8. Wait for green checkmark and "Rules published" message
9. Come back to the app and **refresh the page**
10. Try sending a message now

## How to Test
1. Open two browser windows (incognito mode)
2. Log in as **User A** in Window 1
3. Log in as **User B** in Window 2
4. In Window 1: Go to Home → Like User B's profile
5. In Window 2: Go to Likes → Click chat icon next to User A
6. In Window 2: Type a message and press Send
7. **Check if message appears in both windows in real-time**

## Debugging
Open browser console (F12 → Console) and check for:
- `[sendMessage] Sending message: ...` ✅ Log shows message sending
- `[sendMessage] Message sent successfully` ✅ No error
- `Failed to send message: Permission denied` ❌ Rules blocking it
- `Failed to send message: Conversation not found` ❌ Conv creation failed

If you see "Permission denied", make sure:
1. Rules are published (check the Rules page in Firebase Console shows your new rules)
2. You're logged in (check browser console: `user.uid` exists)
3. Refresh the page after publishing rules

## If Still Not Working
Paste the **exact error message** from browser console (F12 → Console) and I'll fix it.


## Common Errors
- **"Permission denied"**: Rules haven't been published yet, or your UID isn't in the participants list
- **"Conversation not found"**: Try opening the conversation fresh from the Likes page or ProfileCard
- **"Message not sending silently"**: Check browser console for "Failed to send message" logs
