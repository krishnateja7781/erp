I understand you're still facing a "permission-denied" error. This error almost always indicates an issue with your **Cloud Firestore Security Rules**. The Next.js code itself might be correct in *how* it tries to write data, but Firestore's rules are preventing the operation.

Here's what's likely happening and how to address it by configuring your Firestore Security Rules:

**Understanding the Problem**

When your `SignupForm` component successfully creates a user with Firebase Authentication (`createUserWithEmailAndPassword`), that new user gets a Unique ID (UID). The code then tries to create documents in Firestore:

1.  A document in the `users` collection, typically using the `firebaseUser.uid` as the document ID.
2.  A document in a role-specific collection (`students`, `teachers`, or `admins`), often using `studentId` or `staffId` as the document ID, but also including the `firebaseUser.uid` within the document's data for linking.

The "permission-denied" error means your Firestore Security Rules are not allowing the newly authenticated user (identified by their `request.auth.uid` in the rules) to perform these `setDoc` (create) operations on the specified paths.

**How to Fix Firestore Security Rules (General Guidance)**

You'll need to edit your Firestore Security Rules in the Firebase console. Go to your Firebase project -> Firestore Database -> Rules tab.

Here are example rules that would typically allow the signup process to work. **Modify these carefully to fit your exact data structure and security needs.**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Allow any authenticated user to create their OWN document in the 'users' collection.
    // The document ID must match their UID.
    match /users/{userId} {
      allow create: if request.auth != null && request.auth.uid == userId;
      // Add read, update, delete rules as needed, e.g.:
      // allow read, update: if request.auth != null && request.auth.uid == userId;
    }

    // For the 'students' collection
    match /students/{studentDocId} {
      // Allow a newly authenticated user to create their student profile
      // if the 'uid' field in the new document matches their auth UID.
      // AND if the document ID matches the studentId they provided (if using studentId as doc ID).
      allow create: if request.auth != null &&
                       request.resource.data.uid == request.auth.uid &&
                       request.resource.data.id == studentDocId; // Or request.resource.data.collegeId == studentDocId

      // Allow authenticated users to read their own student document
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;

      // Allow admins to read/write any student document
      allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';

      // Add update/delete rules as needed, e.g., student can update their own, admin can update/delete any
    }

    // For the 'teachers' collection
    match /teachers/{teacherDocId} {
      // Allow a newly authenticated user to create their teacher profile
      // if the 'uid' field in the new document matches their auth UID.
      allow create: if request.auth != null &&
                       request.resource.data.uid == request.auth.uid &&
                       request.resource.data.id == teacherDocId; // Or request.resource.data.staffId == teacherDocId

      // Allow authenticated users to read their own teacher document
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;

      // Allow admins to read/write any teacher document
      allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // For the 'admins' collection (creation might be more restricted, e.g., only by other admins)
    match /admins/{adminDocId} {
      // This rule is an example and might be too permissive for admins.
      // Often, admin documents are created manually or by a trusted server-side process.
      allow create: if request.auth != null &&
                       request.resource.data.uid == request.auth.uid &&
                       request.resource.data.id == adminDocId; // Or request.resource.data.staffId == adminDocId


      allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Default deny all other access if not explicitly allowed
    // match /{document=**} {
    //   allow read, write: if false;
    // }
  }
}
```

**Explanation of Example Rules:**

*   `request.auth != null`: Ensures the user is authenticated.
*   `request.auth.uid`: The UID of the user making the request.
*   `userId`, `studentDocId`, `teacherDocId`: These are wildcards representing the document ID in the path.
*   `request.resource.data`: Refers to the data of the document being written (created or updated).
*   `resource.data`: Refers to the data of an existing document being read or deleted.
*   `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'`: This is a common pattern to check if the requesting user has an 'admin' role by looking up their document in the `users` collection.

**Key things to check and adjust in your rules:**

1.  **Document IDs:**
    *   When your `SignupForm` creates a document in `students`, `teachers`, or `admins`, what are you using as the document ID? Is it `studentId`, `staffId`, or the Firebase `uid`? Your rules must match this.
    *   The example rules above assume that for `users/{userId}`, `userId` is `request.auth.uid`.
    *   For `students/{studentDocId}`, it assumes `studentDocId` is the same as the `id` (or `collegeId`) field being written inside the document, AND that the document contains a `uid` field matching `request.auth.uid`.
2.  **Fields for Authorization:**
    *   Ensure that the documents you are writing (e.g., in the `students` collection) include a `uid` field that stores the `firebaseUser.uid`. This allows rules like `resource.data.uid == request.auth.uid`.
3.  **Admin Privileges:** If admins need to create/manage these records, ensure your admin role check is correct.

**No Code Changes Required (in the Next.js app for this specific error):**

The `SignupForm` component you have already correctly:
1.  Authenticates the user first.
2.  Then uses the authenticated user's UID to try and write data.

The "permission-denied" error means the Firestore rules are the bottleneck.