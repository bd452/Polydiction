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
 * Check if running against Firebase Emulator
 * The FIRESTORE_EMULATOR_HOST env var is the standard way to connect to the emulator.
 * When set, Firebase Admin SDK automatically routes requests to the emulator.
 */
function isEmulatorMode(): boolean {
  return !!process.env["FIRESTORE_EMULATOR_HOST"];
}

/**
 * Get Firebase configuration from environment variables
 * In emulator mode, only projectId is required (credentials are bypassed)
 */
function getFirebaseConfig(): FirebaseConfig | { projectId: string } {
  const projectId = process.env["FIREBASE_PROJECT_ID"];

  if (!projectId) {
    throw new Error("Missing required environment variable: FIREBASE_PROJECT_ID");
  }

  // In emulator mode, credentials are not required
  if (isEmulatorMode()) {
    return { projectId };
  }

  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"];

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
 *
 * In emulator mode (FIRESTORE_EMULATOR_HOST is set):
 * - Credentials are not required
 * - Requests are automatically routed to the local emulator
 *
 * In production mode:
 * - Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
function initializeFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const config = getFirebaseConfig();

  // In emulator mode, initialize without credentials
  if (isEmulatorMode()) {
    return initializeApp({
      projectId: config.projectId,
    });
  }

  // Production mode: use service account credentials
  const fullConfig = config as FirebaseConfig;
  const serviceAccount: ServiceAccount = {
    projectId: fullConfig.projectId,
    clientEmail: fullConfig.clientEmail,
    privateKey: fullConfig.privateKey,
  };

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: fullConfig.projectId,
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
