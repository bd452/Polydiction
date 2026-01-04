import { initializeApp, getApps, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase configuration from environment variables
 */
interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Get Firebase configuration from environment variables
 */
function getFirebaseConfig(): FirebaseConfig {
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"];

  if (!projectId) {
    throw new Error("Missing required environment variable: FIREBASE_PROJECT_ID");
  }
  if (!clientEmail) {
    throw new Error("Missing required environment variable: FIREBASE_CLIENT_EMAIL");
  }
  if (!privateKey) {
    throw new Error("Missing required environment variable: FIREBASE_PRIVATE_KEY");
  }

  // Handle escaped newlines in private key (common in env vars)
  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

  return {
    projectId,
    clientEmail,
    privateKey: formattedPrivateKey,
  };
}

/**
 * Initialize Firebase Admin SDK
 * Returns existing app if already initialized (singleton pattern)
 */
function initializeFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const config = getFirebaseConfig();

  const serviceAccount: ServiceAccount = {
    projectId: config.projectId,
    clientEmail: config.clientEmail,
    privateKey: config.privateKey,
  };

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: config.projectId,
  });
}

/**
 * Get Firestore database instance
 * Uses singleton pattern to reuse connection across requests
 */
let firestoreInstance: Firestore | null = null;

export function getDb(): Firestore {
  if (!firestoreInstance) {
    const app = initializeFirebaseApp();
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
}

/**
 * Create a Firestore database instance (alias for getDb)
 * Provided for backwards compatibility with existing code patterns
 */
export function createDb(): Firestore {
  return getDb();
}

export type Database = Firestore;
