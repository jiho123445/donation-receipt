import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Web App SDK Configuration for: donation-receipt-5d4e7
export const firebaseConfig = {
  apiKey: 'AIzaSyD3Yt2oV8p3ZAof_l8Bo-DKbe3Q4BOoAcM',
  authDomain: 'donation-receipt-5d4e7.firebaseapp.com',
  projectId: 'donation-receipt-5d4e7',
  storageBucket: 'donation-receipt-5d4e7.firebasestorage.app',
  messagingSenderId: '639307817392',
  appId: '1:639307817392:web:6e6a10058b7607755b4e7a',
};

// Single Firebase App instance initialization
const existingApps = getApps();
export const app: FirebaseApp = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);

// Auth and Firestore instances bound strictly to the same app
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const firebaseConfigured = true;

export interface FirebaseDiagnostics {
  projectId: string;
  authDomain: string;
  apiKeyPrefix: string;
  appIdPrefix: string;
  isAppInitialized: boolean;
  appName: string;
  isAuthConnected: boolean;
  isFirestoreConnected: boolean;
}

export function getFirebaseDiagnostics(): FirebaseDiagnostics {
  const apiKey = firebaseConfig.apiKey || '';
  const appId = firebaseConfig.appId || '';

  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 6)}...` : '미설정',
    appIdPrefix: appId ? `${appId.substring(0, 10)}...` : '미설정',
    isAppInitialized: !!app && app.name === '[DEFAULT]',
    appName: app ? app.name : '미초기화',
    isAuthConnected: !!auth && auth.app?.name === app?.name,
    isFirestoreConnected: !!db && db.app?.name === app?.name,
  };
}
