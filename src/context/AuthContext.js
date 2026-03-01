import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Fetch user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                }
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const register = async (email, password, name, phone, role, vehicleInfo = null) => {
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

        await setDoc(doc(db, 'users', newUser.uid), userProfile);

        // If driver, create driver document
        if (role === 'driver') {
            await setDoc(doc(db, 'drivers', newUser.uid), {
                isOnline: false,
                location: null,
                vehicle: vehicleInfo || { make: '', model: '', plate: '', color: '' },
                currentRideId: null,
            });
        }

        setUserData(userProfile);
        return newUser;
    };

    const login = async (email, password) => {
        const { user: loggedUser } = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', loggedUser.uid));
        if (userDoc.exists()) {
            setUserData(userDoc.data());
        }
        return loggedUser;
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setUserData(null);
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
