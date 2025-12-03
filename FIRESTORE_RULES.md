rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 1. Users & Liked Profiles
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;

      match /likedProfiles/{profileId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /likedBy/{sourceUid} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null && request.auth.uid == sourceUid;
      }
    }

    // 2. Conversations
    match /conversations/{conversationId} {
      // FIX: Allow read if doc doesn't exist (resource == null) OR if user is participant
      allow read: if request.auth != null && (
        resource == null || request.auth.uid in resource.data.participants
      );
      
      allow create: if request.auth != null;
      
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        
        allow create: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
  }
}
