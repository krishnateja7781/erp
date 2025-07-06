
// src/lib/firebaseClient.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDWv0F-oHc1Rqfz5M4Jk0P8nfo5wWNGK9g",
  authDomain: "ssn-college-321fe.firebaseapp.com",
  databaseURL: "https://ssn-college-321fe-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ssn-college-321fe",
  storageBucket: "ssn-college-321fe.appspot.com",
  messagingSenderId: "871907465341",
  appId: "1:871907465341:web:776cb600f8b8d5cadf7914",
  measurementId: "G-SXM153KMWB"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId
  ) {
    console.error(
      'Firebase client configuration is missing. Ensure your environment variables are set correctly.'
    );
  }
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app);
// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
