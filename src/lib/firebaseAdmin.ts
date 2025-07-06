
import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let appInstance: admin.app.App;
let initializationError: Error | null = null;
let isInitialized = false;

function initializeFirebaseAdmin() {
  if (isInitialized) {
    if (initializationError) throw initializationError;
    return;
  }
  isInitialized = true;

  console.log("Firebase Admin SDK: Starting initialization...");

  try {
    if (admin.apps.length > 0 && admin.apps[0]) {
      console.log("Firebase Admin SDK: App already initialized.");
      appInstance = admin.apps[0];
      return;
    }

    let serviceAccountString: string;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("Firebase Admin SDK: Initializing with FIREBASE_SERVICE_ACCOUNT env var.");
      serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    } else {
      const defaultServiceAccountPath = './firebase-service-account-key.json';
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || defaultServiceAccountPath;
      const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
      
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Service account file not found at ${resolvedPath}. Please set the FIREBASE_SERVICE_ACCOUNT env var or place the file at the default path.`);
      }
      console.log(`Firebase Admin SDK: Initializing with file at ${resolvedPath}`);
      serviceAccountString = fs.readFileSync(resolvedPath, 'utf8');
    }
    
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountString);

    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Service account JSON is malformed. It must contain 'project_id', 'client_email', and 'private_key'.");
    }
    
    const databaseURL = `https://${serviceAccount.project_id}.firebaseio.com`;

    console.log("Firebase Admin SDK: Attempting to initialize app with project ID:", serviceAccount.project_id);
    appInstance = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
    console.log("🟢 Firebase Admin SDK: Initialization successful for project:", serviceAccount.project_id);
    
  } catch (error: any) {
    initializationError = new Error(`Firebase Admin SDK Init Failed: ${error.message}`);
    console.error("🔴 " + initializationError.message, error.stack);
    // Re-throw the error to ensure server startup fails clearly if admin SDK can't init
    throw initializationError;
  }
}

// Initialize on module load
initializeFirebaseAdmin();

export const auth = admin.auth();
export const db = admin.firestore();
export const adminSDK = admin;
