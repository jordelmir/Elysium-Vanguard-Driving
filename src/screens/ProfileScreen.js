import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
    SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, calculateRatingPercentage } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { formatPrice } from '../lib/pricing';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/colors';
import { scale, moderateScale, SAFE_TOP, SAFE_BOTTOM } from '../theme/responsive';

export default function ProfileScreen({ navigation }) {
    const { user, userData, logout, refreshUserData } = useAuth();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [driverData, setDriverData] = useState(null);

    useEffect(() => {
        if (userData) {
            setName(userData.name || '');
            setPhone(userData.phone || '');
        } else if (user) {
            refreshUserData();
        }
    }, [userData, user]);

    useEffect(() => {
        if (!user || userData?.role !== 'driver') return;
        const unsubscribe = onSnapshot(doc(db, 'drivers', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                setDriverData(docSnap.data());
            }
        });
        return unsubscribe;
    }, [user, userData?.role]);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'El nombre no puede estar vacío');
            return;
        }
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                name: name.trim(),
                phone: phone.trim(),
            });
            await refreshUserData();
            setIsEditing(false);
            Alert.alert('✅ Éxito', 'Perfil actualizado correctamente.');
        } catch (error) {
            console.error('Save profile error:', error);
            Alert.alert('Error', 'No se pudo conectar con el servidor.');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmLogout = () => {
        Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro de que deseas salir?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', onPress: logout, style: 'destructive' },
            ]
        );
    };

    const ratingDisplay = calculateRatingPercentage(userData?.rating || 5.0);
    const totalRides = userData?.totalRides || 0;
    const isDriver = userData?.role === 'driver';

    return (
        <View style={styles.container}>
            <ScrollView
                stickyHeaderIndices={[0]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* 1. Header Mundial con Gradiente y Avatar Pro */}
                <View style={styles.eliteHeaderContainer}>
                    <LinearGradient
                        colors={['#1A1A1A', '#000000']}
                        style={styles.headerGradient}
                    >
                        <SafeAreaView>
                            <View style={styles.headerTopRow}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>MI PERFIL</Text>
                                <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editIconBtn}>
                                    <Ionicons name={isEditing ? "close" : "create-outline"} size={22} color={isEditing ? "#F44336" : "#FFD600"} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.profileHero}>
                                <View style={styles.avatarWrapper}>
                                    <View style={styles.avatarGlow} />
                                    <View style={styles.avatarMain}>
                                        <Text style={styles.avatarEmoji}>{isDriver ? '🚗' : '👤'}</Text>
                                    </View>
                                    <View style={styles.onlineBadge} />
                                </View>
                                <Text style={styles.heroName}>{userData?.name || 'Vanguard Member'}</Text>
                                <View style={styles.roleTag}>
                                    <Text style={styles.roleTagText}>{isDriver ? 'DRIVER GOLD' : 'RIDER ELITE'}</Text>
                                </View>
                            </View>
                        </SafeAreaView>
                    </LinearGradient>
                </View>

                {/* 2. Grid de Estadísticas Premium */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>⭐ {ratingDisplay}</Text>
                        <Text style={styles.statLabel}>Calificación</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{totalRides}</Text>
                        <Text style={styles.statLabel}>Viajes</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>2y</Text>
                        <Text style={styles.statLabel}>Antigüedad</Text>
                    </View>
                </View>

                {/* 3. Formulario de Datos Pro */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeadline}>Información de Cuenta</Text>

                    <View style={styles.inputGroup}>
                        <Ionicons name="person-outline" size={20} color="#555" />
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
                            {isEditing ? (
                                <TextInput
                                    style={styles.eliteInput}
                                    value={name}
                                    onChangeText={setName}
                                    placeholderTextColor="#444"
                                />
                            ) : (
                                <Text style={styles.readOnlyValue}>{name}</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Ionicons name="call-outline" size={20} color="#555" />
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>TELÉFONO DE CONTACTO</Text>
                            {isEditing ? (
                                <TextInput
                                    style={styles.eliteInput}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    placeholderTextColor="#444"
                                />
                            ) : (
                                <Text style={styles.readOnlyValue}>{phone || 'No registrado'}</Text>
                            )}
                        </View>
                    </View>

                    {isEditing && (
                        <TouchableOpacity style={styles.vanguardSaveBtn} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>ACTUALIZAR PERFIL</Text>}
                        </TouchableOpacity>
                    )}
                </View>

                {/* 4. Tarjetas de Acción de Clase Mundial */}
                <View style={[styles.sectionContainer, { marginTop: 10 }]}>
                    <Text style={styles.sectionHeadline}>Configuración y Seguridad</Text>

                    <TouchableOpacity style={styles.vanguardCard} onPress={() => navigation.navigate(isDriver ? 'DriverHistory' : 'RiderHistory')}>
                        <View style={[styles.cardIconBox, { backgroundColor: 'rgba(255,214,0,0.1)' }]}>
                            <Ionicons name="time-outline" size={22} color="#FFD600" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardMain}>Historial de Viajes</Text>
                            <Text style={styles.cardSub}>Ver trayectos y facturación</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#444" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.vanguardCard}>
                        <View style={[styles.cardIconBox, { backgroundColor: 'rgba(76,175,80,0.1)' }]}>
                            <Ionicons name="wallet-outline" size={22} color="#4CAF50" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardMain}>Métodos de Pago</Text>
                            <Text style={styles.cardSub}>Gestionar tarjetas y efectivo</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#444" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.vanguardCard, styles.logoutCard]} onPress={confirmLogout}>
                        <View style={[styles.cardIconBox, { backgroundColor: 'rgba(244,67,54,0.1)' }]}>
                            <Ionicons name="log-out-outline" size={22} color="#F44336" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardMain, { color: '#F44336' }]}>Cerrar Sesión</Text>
                            <Text style={styles.cardSub}>Salir de la cuenta de forma segura</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ height: scale(100) }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollContent: {
        flexGrow: 1,
    },
    eliteHeaderContainer: {
        width: '100%',
        zIndex: 10,
    },
    headerGradient: {
        paddingBottom: scale(40),
        borderBottomLeftRadius: scale(40),
        borderBottomRightRadius: scale(40),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 3,
    },
    editIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileHero: {
        alignItems: 'center',
        marginTop: 20,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarGlow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#FFD600',
        opacity: 0.1,
    },
    avatarMain: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#111',
        borderWidth: 2,
        borderColor: '#FFD600',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#FFD600',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    avatarEmoji: {
        fontSize: 40,
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#4CAF50',
        borderWidth: 3,
        borderColor: '#000',
    },
    heroName: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
        marginTop: 15,
    },
    roleTag: {
        backgroundColor: 'rgba(255,214,0,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,214,0,0.3)',
    },
    roleTagText: {
        color: '#FFD600',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
    },
    statsGrid: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: -30,
        gap: 12,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        elevation: 10,
    },
    statValue: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    statLabel: {
        color: '#555',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
        textTransform: 'uppercase',
    },
    sectionContainer: {
        paddingHorizontal: 20,
        marginTop: 30,
    },
    sectionHeadline: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 20,
        letterSpacing: 1,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A0A0A',
        padding: 15,
        borderRadius: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    inputWrapper: {
        flex: 1,
        marginLeft: 15,
    },
    inputLabel: {
        color: '#444',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    eliteInput: {
        color: '#FFD600',
        fontSize: 16,
        fontWeight: '700',
        padding: 0,
    },
    readOnlyValue: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    vanguardSaveBtn: {
        backgroundColor: '#FFD600',
        height: 55,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        elevation: 8,
    },
    saveText: {
        color: '#000',
        fontWeight: '900',
        letterSpacing: 1,
    },
    vanguardCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A0A0A',
        padding: 15,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.02)',
    },
    cardIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    cardContent: {
        flex: 1,
    },
    cardMain: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
    },
    cardSub: {
        color: '#555',
        fontSize: 11,
        marginTop: 2,
    },
    logoutCard: {
        marginTop: 10,
        borderColor: 'rgba(244,67,54,0.1)',
    }
});
