# Firebase Rules for Repost Functionality

If you decide to use Firebase later, here are the security rules for the Repost functionality.
You can add these rules into your `firestore.rules` file under the posts collection rules.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... your other rules ...

    match /posts/{postId} {
      allow read: if true; // Or your specific read rule
      
      // Reposting Rule
      // To repost, a user creates a new post with `type: 'repost'` and `repostOf: originalPostId`
      allow create: if request.auth != null 
                    && request.resource.data.authorId == request.auth.uid
                    && (
                      request.resource.data.type != 'repost' || 
                      (
                        request.resource.data.type == 'repost' &&
                        request.resource.data.keys().hasAll(['repostOf', 'originalAuthorId']) &&
                        exists(/databases/$(database)/documents/posts/$(request.resource.data.repostOf))
                      )
                    );
    }
  }
}
```
