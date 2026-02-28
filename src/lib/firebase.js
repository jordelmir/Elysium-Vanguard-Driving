// Firebase Configuration for Elysium Vanguard Driving
// Using Firebase v9+ modular SDK
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configured for rutalibre-app
const firebaseConfig = {
    apiKey: "AIzaSyDN118qU7ZIi40G3xssSWBXKeDQZ5DNOzs",
    authDomain: "rutalibre-app.firebaseapp.com",
    projectId: "rutalibre-app",
    storageBucket: "rutalibre-app.firebasestorage.app",
    messagingSenderId: "190105536586",
    appId: "1:190105536586:android:bf08a053013d78d10f3eb3"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

export default app;
