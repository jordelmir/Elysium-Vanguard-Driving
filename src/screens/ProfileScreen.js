import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
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
            // If we have a user but no data, try to refresh
            refreshUserData();
        }
    }, [userData, user]);

    // Listen for driver-specific data
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
            // Create a 5-second timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 5000)
            );

            // Execute update and refresh with timeout protection
            await Promise.race([
                (async () => {
                    await updateDoc(doc(db, 'users', user.uid), {
                        name: name.trim(),
                        phone: phone.trim(),
                    });
                    await refreshUserData();
                })(),
                timeoutPromise
            ]);

            setIsEditing(false);
            Alert.alert('✅ Éxito', 'Perfil actualizado correctamente.');
        } catch (error) {
            console.error('Save profile error:', error);
            if (error.message === 'timeout') {
                Alert.alert(
                    '⏳ Tiempo Agotado',
                    'La conexión es lenta. El servidor procesará los cambios en breve.',
                    [{ text: 'Entendido', onPress: () => setIsEditing(false) }]
                );
            } else {
                Alert.alert('Error', 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
            }
        } finally {
            setIsSaving(false);
            // Safety: Ensure loading state is cleared and we exit editing mode if needed
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
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Card */}
                <View style={styles.headerCard}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarEmoji}>
                                {isDriver ? '🚗' : '👤'}
                            </Text>
                        </View>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>
                                {isDriver ? 'Conductor' : 'Pasajero'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.userName}>{userData?.name || user?.displayName || 'Usuario'}</Text>
                    <Text style={styles.userEmail}>{userData?.email || user?.email || ''}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>⭐ {ratingDisplay}</Text>
                            <Text style={styles.statLabel}>Calificación</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{totalRides}</Text>
                            <Text style={styles.statLabel}>Viajes</Text>
                        </View>
                        {isDriver && driverData && (
                            <>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>
                                        {formatPrice(driverData.totalEarnings || 0)}
                                    </Text>
                                    <Text style={styles.statLabel}>Ganancias</Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Información Personal</Text>
                        {!isEditing ? (
                            <TouchableOpacity onPress={() => setIsEditing(true)}>
                                <Text style={styles.editBtn}>✏️ Editar</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={() => {
                                setIsEditing(false);
                                setName(userData?.name || '');
                                setPhone(userData?.phone || '');
                            }}>
                                <Text style={styles.cancelEditBtn}>Cancelar</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Nombre</Text>
                        {isEditing ? (
                            <TextInput
                                style={styles.infoInput}
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor={COLORS.textMuted}
                            />
                        ) : (
                            <Text style={styles.infoValue}>{userData?.name || '-'}</Text>
                        )}
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{userData?.email || user?.email || '-'}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Teléfono</Text>
                        {isEditing ? (
                            <TextInput
                                style={styles.infoInput}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                placeholderTextColor={COLORS.textMuted}
                            />
                        ) : (
                            <Text style={styles.infoValue}>{userData?.phone || '-'}</Text>
                        )}
                    </View>

                    {isEditing && (
                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Vehicle Info (Driver Only) */}
                {isDriver && driverData?.vehicle && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Mi Vehículo</Text>

                        <View style={styles.vehicleCard}>
                            <Text style={styles.vehicleEmoji}>🚘</Text>
                            <View style={styles.vehicleInfo}>
                                <Text style={styles.vehicleName}>
                                    {driverData.vehicle.make} {driverData.vehicle.model}
                                </Text>
                                <Text style={styles.vehicleDetail}>
                                    Color: {driverData.vehicle.color}
                                </Text>
                                <View style={styles.plateBadge}>
                                    <Text style={styles.plateText}>
                                        {driverData.vehicle.plate}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => {
                        if (isDriver) {
                            navigation.navigate('DriverHistory');
                        } else {
                            navigation.navigate('RiderHistory');
                        }
                    }}>
                        <Text style={styles.actionIcon}>📋</Text>
                        <Text style={styles.actionText}>Historial de Viajes</Text>
                        <Text style={styles.actionArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionItem, styles.logoutAction]} onPress={confirmLogout}>
                        <Text style={styles.actionIcon}>🚪</Text>
                        <Text style={[styles.actionText, styles.logoutText]}>Cerrar Sesión</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: SAFE_BOTTOM + scale(20) }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    scrollContent: {
        paddingTop: SAFE_TOP + scale(SPACING.md),
        paddingHorizontal: scale(SPACING.md),
    },
    headerCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        padding: scale(SPACING.xl),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: scale(SPACING.md),
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: scale(SPACING.md),
    },
    avatar: {
        width: scale(90),
        height: scale(90),
        borderRadius: scale(45),
        backgroundColor: COLORS.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    avatarEmoji: {
        fontSize: moderateScale(40),
    },
    roleBadge: {
        marginTop: scale(-12),
        backgroundColor: COLORS.accent,
        paddingHorizontal: scale(SPACING.md),
        paddingVertical: scale(4),
        borderRadius: RADIUS.full,
    },
    roleBadgeText: {
        color: '#fff',
        fontSize: moderateScale(FONTS.sizes.xs),
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    userName: {
        fontSize: moderateScale(FONTS.sizes.xxl),
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: scale(4),
    },
    userEmail: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textMuted,
        marginBottom: scale(SPACING.lg),
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '800',
        color: COLORS.accent,
    },
    statLabel: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
        marginTop: scale(4),
    },
    statDivider: {
        width: 1,
        height: scale(30),
        backgroundColor: COLORS.border,
        marginHorizontal: scale(SPACING.sm),
    },
    section: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: scale(SPACING.lg),
        marginBottom: scale(SPACING.md),
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(SPACING.md),
    },
    sectionTitle: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    editBtn: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.accent,
        fontWeight: '600',
    },
    cancelEditBtn: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.error,
        fontWeight: '600',
    },
    infoRow: {
        paddingVertical: scale(SPACING.sm),
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    infoLabel: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: scale(4),
    },
    infoValue: {
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    infoInput: {
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textPrimary,
        fontWeight: '500',
        borderBottomWidth: 2,
        borderBottomColor: COLORS.accent,
        paddingVertical: scale(4),
    },
    saveBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.md,
        paddingVertical: scale(SPACING.md),
        alignItems: 'center',
        marginTop: scale(SPACING.lg),
    },
    saveBtnText: {
        color: '#fff',
        fontSize: moderateScale(FONTS.sizes.md),
        fontWeight: '700',
    },
    vehicleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgPrimary,
        borderRadius: RADIUS.md,
        padding: scale(SPACING.md),
        marginTop: scale(SPACING.sm),
        gap: scale(SPACING.md),
    },
    vehicleEmoji: {
        fontSize: moderateScale(36),
    },
    vehicleInfo: {
        flex: 1,
    },
    vehicleName: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    vehicleDetail: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textSecondary,
        marginTop: scale(2),
    },
    plateBadge: {
        backgroundColor: COLORS.accent + '22',
        alignSelf: 'flex-start',
        paddingHorizontal: scale(SPACING.sm),
        paddingVertical: scale(3),
        borderRadius: RADIUS.sm,
        marginTop: scale(SPACING.xs),
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    plateText: {
        fontSize: moderateScale(FONTS.sizes.md),
        fontWeight: '800',
        color: COLORS.accent,
        letterSpacing: 2,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(SPACING.md),
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
        gap: scale(SPACING.md),
    },
    actionIcon: {
        fontSize: moderateScale(22),
    },
    actionText: {
        flex: 1,
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    actionArrow: {
        fontSize: moderateScale(22),
        color: COLORS.textMuted,
    },
    logoutAction: {
        borderBottomWidth: 0,
    },
    logoutText: {
        color: COLORS.error,
    },
});
