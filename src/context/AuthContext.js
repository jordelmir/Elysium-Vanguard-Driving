import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingOverlay from '../components/LoadingOverlay';

const AuthContext = createContext({});
export const calculateRatingPercentage = (sum, count) => {
    if (!count || count === 0) return 100; // New users start at 100%
    const avg = sum / count;
    return Math.round((avg / 10) * 100);
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cachedRole, setCachedRole] = useState(null);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const fetchUserData = async (uid) => {
        try {
            // timeout 5 seconds
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout fetching user data")), 5000)
            );
            const fetchPromise = getDoc(doc(db, 'users', uid));

            const userDoc = await Promise.race([fetchPromise, timeoutPromise]);

            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData(data);
                if (data.role) {
                    setCachedRole(data.role);
                    await AsyncStorage.setItem('user_role', data.role);
                }
                return data;
            } else {
                // Document doesn't exist, but we have a user. 
                // Let's create a minimal profile to at least allow app to function
                console.warn("User document does not exist for UID:", uid);
                // Try to get email from auth
                const authUser = auth.currentUser;
                if (authUser && authUser.uid === uid) {
                    const minimalData = {
                        uid: uid,
                        email: authUser.email || '',
                        name: authUser.displayName || 'Usuario',
                        role: 'rider', // Default to rider
                    };
                    setUserData(minimalData);
                    return minimalData;
                }
            }
            return null;
        } catch (error) {
            console.error("Error fetching user data:", error);
            // Check if we have a cached role at least
            const savedRole = await AsyncStorage.getItem('user_role');
            if (savedRole) setCachedRole(savedRole);

            // Fallback for UI if we at least have the auth user
            const authUser = auth.currentUser;
            if (authUser && authUser.uid === uid && !userData) {
                setUserData({
                    uid: uid,
                    email: authUser.email || '',
                    name: authUser.displayName || 'Usuario',
                    role: savedRole || 'rider'
                });
            }
            return null;
        }
    };

    useEffect(() => {
        // Load cached role immediately
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setCachedRole(role);
        });

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Don't await here to avoid blocking loading state if we have cached role
                fetchUserData(firebaseUser.uid).finally(() => setLoading(false));
            } else {
                setUser(null);
                setUserData(null);
                setCachedRole(null);
                await AsyncStorage.removeItem('user_role');
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    const refreshUserData = async () => {
        if (user) {
            return await fetchUserData(user.uid);
        }
    };

    const register = async (email, password, name, phone, role, vehicleInfo = null) => {
        setActionLoading(true);
        setLoadingMessage('Creando cuenta...');
        try {
            const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

            const userProfile = {
                uid: newUser.uid,
                name,
                email,
                phone,
                role, // 'rider' or 'driver'
                ratingSum: 0,
                ratingCount: 0,
                totalRides: 0,
                createdAt: new Date().toISOString(),
            };

            // Ensure user document exists first
            await setDoc(doc(db, 'users', newUser.uid), userProfile);

            // If driver, create driver document immediately with provided info
            if (role === 'driver') {
                await setDoc(doc(db, 'drivers', newUser.uid), {
                    isOnline: false,
                    location: null,
                    vehicle: vehicleInfo || { make: '', model: '', plate: '', color: '' },
                    currentRideId: null,
                    createdAt: new Date().toISOString(),
                });
            }

            setUserData(userProfile);
            setCachedRole(role);
            await AsyncStorage.setItem('user_role', role);
            return newUser;
        } finally {
            setActionLoading(false);
        }
    };

    const login = async (email, password) => {
        setActionLoading(true);
        setLoadingMessage('Iniciando sesión...');
        try {
            const { user: loggedUser } = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', loggedUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData(data);
                if (data.role) {
                    setCachedRole(data.role);
                    await AsyncStorage.setItem('user_role', data.role);
                }
            }
            return loggedUser;
        } finally {
            setActionLoading(false);
        }
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setUserData(null);
        setCachedRole(null);
        await AsyncStorage.removeItem('user_role');
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, cachedRole, error, login, register, logout, refreshUserData }}>
            {children}
            <LoadingOverlay visible={actionLoading} message={loadingMessage} />
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
