import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { CARTO_DARK_TILES } from '../rider/RiderDashboard';
import { useAuth } from '../../context/AuthContext';
import { watchLocation } from '../../lib/geo';
import { formatPrice } from '../../lib/pricing';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, GeoPoint, serverTimestamp } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';

// Dark map style removed as CARTO_DARK_TILES will be used in WebViewLeaflet

export default function ActiveRide({ route, navigation }) {
    const { rideId } = route.params;
    const { user } = useAuth();
    const mapRef = useRef(null);

    const [ride, setRide] = useState(null);
    const [myLocation, setMyLocation] = useState(null);

    // Listen for ride data
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'rides', rideId), (docSnap) => {
            if (docSnap.exists()) {
                setRide(docSnap.data());
            }
        });
        return unsubscribe;
    }, [rideId]);

    // Track driver location continuously
    useEffect(() => {
        let subscription;

        (async () => {
            subscription = await watchLocation(async (location) => {
                setMyLocation(location);
                // Update driver position in Firestore
                if (user) {
                    try {
                        await updateDoc(doc(db, 'drivers', user.uid), {
                            location: new GeoPoint(location.latitude, location.longitude),
                        });
                    } catch (e) { }
                }
            });
        })();

        return () => {
            if (subscription) subscription.remove();
        };
    }, [user]);

    // Update ride status
    const updateRideStatus = async (newStatus) => {
        try {
            const updates = { status: newStatus };
            if (newStatus === 'completed') {
                updates.completedAt = serverTimestamp();
            }
            await updateDoc(doc(db, 'rides', rideId), updates);

            if (newStatus === 'completed') {
                // Reset driver state
                await updateDoc(doc(db, 'drivers', user.uid), {
                    currentRideId: null,
                });
                Alert.alert(
                    '✅ ¡Viaje completado!',
                    `Cobrar: ${formatPrice(ride?.acceptedPrice || ride?.proposedPrice || 0)}\nComisión Elysium Vanguard Driving: ${formatPrice(Math.round((ride?.acceptedPrice || ride?.proposedPrice || 0) * 0.01))}`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el viaje');
        }
    };

    const getStatusInfo = () => {
        switch (ride?.status) {
            case 'accepted':
                return {
                    label: 'Navega al punto de recogida',
                    icon: '📍',
                    action: 'Llegué al punto',
                    nextStatus: 'arriving',
                    color: COLORS.info,
                };
            case 'arriving':
                return {
                    label: 'Esperando al pasajero',
                    icon: '⏳',
                    action: 'Pasajero a bordo',
                    nextStatus: 'in_progress',
                    color: COLORS.warning,
                };
            case 'in_progress':
                return {
                    label: 'En viaje al destino',
                    icon: '🛣️',
                    action: 'Llegamos al destino',
                    nextStatus: 'completed',
                    color: COLORS.success,
                };
            default:
                return {
                    label: 'Cargando...',
                    icon: '⏳',
                    action: '',
                    nextStatus: null,
                    color: COLORS.textMuted,
                };
        }
    };

    const statusInfo = getStatusInfo();
    const destination = ride?.status === 'in_progress' ? ride?.dropoff : ride?.pickup;

    return (
        <View style={styles.container}>
            {/* Map */}
            {destination && (
                <View style={styles.map}>
                    <LeafletView
                        ref={mapRef}
                        backgroundColor={COLORS.bgPrimary}
                        mapLayers={[
                            {
                                baseLayerName: 'CartoDB Dark Matter',
                                baseLayerIsActive: true,
                                url: CARTO_DARK_TILES,
                                attribution: '&copy; OpenStreetMap contributors',
                            }
                        ]}
                        mapCenterPosition={{
                            lat: destination.latitude,
                            lng: destination.longitude
                        }}
                        zoom={16}
                        mapMarkers={[
                            ...(myLocation ? [{
                                id: 'driver-loc',
                                position: { lat: myLocation.latitude, lng: myLocation.longitude },
                                icon: '🚗',
                                size: [32, 32],
                            }] : []),
                            ...(ride?.pickup ? [{
                                id: 'pickup-loc',
                                position: { lat: ride.pickup.latitude, lng: ride.pickup.longitude },
                                icon: '🟢',
                                size: [28, 28],
                            }] : []),
                            ...(ride?.dropoff ? [{
                                id: 'dropoff-loc',
                                position: { lat: ride.dropoff.latitude, lng: ride.dropoff.longitude },
                                icon: '🔴',
                                size: [28, 28],
                            }] : [])
                        ]}
                    />
                </View>
            )}

            {/* Back to map button */}
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                    Alert.alert(
                        'Cancelar viaje',
                        '¿Estás seguro de cancelar este viaje?',
                        [
                            { text: 'No', style: 'cancel' },
                            {
                                text: 'Sí, cancelar',
                                style: 'destructive',
                                onPress: async () => {
                                    await updateDoc(doc(db, 'rides', rideId), { status: 'cancelled' });
                                    await updateDoc(doc(db, 'drivers', user.uid), { currentRideId: null });
                                    navigation.goBack();
                                },
                            },
                        ]
                    );
                }}
            >
                <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>

            {/* Bottom ride panel */}
            <View style={styles.bottomPanel}>
                {/* Status */}
                <View style={[styles.statusRow, { borderLeftColor: statusInfo.color }]}>
                    <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                    <Text style={styles.statusLabel}>{statusInfo.label}</Text>
                </View>

                {/* Rider info */}
                <View style={styles.riderRow}>
                    <View style={styles.riderInfo}>
                        <Text style={styles.riderAvatar}>👤</Text>
                        <View>
                            <Text style={styles.riderName}>{ride?.riderName || 'Pasajero'}</Text>
                            <Text style={styles.riderPhone}>{ride?.riderPhone || ''}</Text>
                        </View>
                    </View>
                    <View style={styles.ridePriceBox}>
                        <Text style={styles.ridePriceLabel}>Cobrar</Text>
                        <Text style={styles.ridePrice}>
                            {formatPrice(ride?.acceptedPrice || ride?.proposedPrice || 0)}
                        </Text>
                    </View>
                </View>

                {/* Destination info */}
                <View style={styles.navCard}>
                    <Text style={styles.navIcon}>{ride?.status === 'in_progress' ? '🏁' : '📍'}</Text>
                    <View style={styles.navInfo}>
                        <Text style={styles.navLabel}>
                            {ride?.status === 'in_progress' ? 'Destino' : 'Punto de recogida'}
                        </Text>
                        <Text style={styles.navAddress}>
                            {destination?.name || 'Cargando dirección...'}
                        </Text>
                    </View>
                </View>

                {/* Action button */}
                {statusInfo.nextStatus && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: statusInfo.color }]}
                        onPress={() => updateRideStatus(statusInfo.nextStatus)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionBtnText}>{statusInfo.action}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },

    backBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 40,
        left: SPACING.md,
        backgroundColor: COLORS.bgOverlay,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backBtnText: {
        fontSize: 22,
        color: COLORS.textPrimary,
    },
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.bgSecondary,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        padding: SPACING.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
        borderTopWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        borderLeftWidth: 3,
        paddingLeft: SPACING.sm,
        marginBottom: SPACING.md,
    },
    statusIcon: {
        fontSize: 20,
    },
    statusLabel: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    riderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    riderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    riderAvatar: {
        fontSize: 32,
    },
    riderName: {
        fontSize: FONTS.sizes.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    riderPhone: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
    },
    ridePriceBox: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    ridePriceLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
    },
    ridePrice: {
        fontSize: FONTS.sizes.xl,
        fontWeight: '800',
        color: COLORS.accent,
    },
    navCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        gap: SPACING.sm,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    navIcon: {
        fontSize: 24,
    },
    navInfo: {
        flex: 1,
    },
    navLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    navAddress: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textPrimary,
        fontWeight: '500',
        marginTop: 2,
    },
    actionBtn: {
        borderRadius: RADIUS.xl,
        paddingVertical: 16,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    actionBtnText: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: '#ffffff',
    },
});
