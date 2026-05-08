import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure firebaseConfig is valid
if (!firebaseConfig || !firebaseConfig.projectId) {
  console.error("Firebase configuration is missing or invalid. Please check firebase-applet-config.json.");
}

// Initialize Firebase only if it hasn't been initialized yet
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with the specific database ID from config
// This is crucial for environments using named databases
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// MANDATORY: Call getFromServer to test the connection on boot
const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection verified.");
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('code=unavailable'))) {
      console.error("CRITICAL: Could not reach Firestore. Please verify that the database is provisioned and your configuration is correct.");
    } else {
      console.warn("Firestore connection test completed with expected restricted access.");
    }
  }
};

testConnection();
