import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Platform, Alert, Animated,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { CARTO_DARK_TILES } from '../rider/RiderDashboard';
import { useAuth } from '../../context/AuthContext';
import { watchLocation } from '../../lib/geo';
import { formatPrice, calculateCommission } from '../../lib/pricing';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, GeoPoint, serverTimestamp, increment } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { scale, moderateScale, SAFE_TOP, SAFE_BOTTOM } from '../../theme/responsive';
import RatingModal from '../../components/RatingModal';
import { getRoute } from '../../lib/geo';

// Dark map style removed as CARTO_DARK_TILES will be used in WebViewLeaflet

export default function ActiveRide({ route, navigation }) {
    const { rideId } = route.params;
    const { user } = useAuth();
    const mapRef = useRef(null);

    const [ride, setRide] = useState(null);
    const [myLocation, setMyLocation] = useState(null);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [routeCoords, setRouteCoords] = useState([]);

    const breatheAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(breatheAnim, {
                    toValue: 1.05,
                    duration: 3000,
                    useNativeDriver: true,
                }),
                Animated.timing(breatheAnim, {
                    toValue: 1,
                    duration: 3000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 4000,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.3,
                    duration: 4000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Listen for ride data
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'rides', rideId), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRide(data);

                // Fetch route if not yet fetched
                if (data.pickup && (data.dropoff || data.dropoffs?.length > 0) && routeCoords.length === 0) {
                    const points = [
                        { latitude: data.pickup.latitude, longitude: data.pickup.longitude },
                        ...(data.dropoffs || [])
                    ].filter(p => p && p.latitude);

                    if (!data.dropoffs && data.dropoff) {
                        points.push({ latitude: data.dropoff.latitude, longitude: data.dropoff.longitude });
                    }

                    if (points.length >= 2) {
                        try {
                            const route = await getRoute(points);
                            if (route && route.coordinates) {
                                setRouteCoords(route.coordinates);
                            }
                        } catch (e) {
                            console.error("Failed to fetch route for active ride tracking", e);
                        }
                    }
                }
            }
        });
        return unsubscribe;
    }, [rideId, routeCoords.length]);

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
                const price = ride?.acceptedPrice || ride?.proposedPrice || 0;
                const { driverEarns, commission } = calculateCommission(price);

                // Update driver state and persist earnings
                await updateDoc(doc(db, 'drivers', user.uid), {
                    currentRideId: null,
                    totalEarnings: increment(driverEarns),
                    totalRides: increment(1),
                });

                // Show rating modal first, then navigate away
                setShowRatingModal(true);
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el viaje');
        }
    };

    const handleFinishRating = async (rating) => {
        try {
            // Update rider rating
            if (ride?.riderId) {
                await updateDoc(doc(db, 'users', ride.riderId), {
                    ratingSum: increment(rating),
                    ratingCount: increment(1),
                    totalRides: increment(1),
                });
            }

            setShowRatingModal(false);
            const price = ride?.acceptedPrice || ride?.proposedPrice || 0;
            const { driverEarns, commission } = calculateCommission(price);
            Alert.alert(
                '✅ ¡Viaje completado!',
                `Cobrar: ${formatPrice(price)}\nTu ganancia: ${formatPrice(driverEarns)}\nComisión Elysium: ${formatPrice(commission)} (1%)`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo guardar la calificación');
            navigation.goBack();
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
    const destination = ride?.status === 'in_progress'
        ? (ride?.dropoffs ? ride.dropoffs[ride.dropoffs.length - 1] : ride?.dropoff)
        : ride?.pickup;

    const renderDropoffMarkers = () => {
        if (ride?.dropoffs && ride.dropoffs.length > 0) {
            return [
                ...ride.dropoffs.slice(0, -1).map((d, index) => ({
                    id: `dropoff-loc-${index}`,
                    position: { lat: d.latitude, lng: d.longitude },
                    icon: `📍 ${String.fromCharCode(66 + index)}`,
                    size: [24, 24],
                })),
                {
                    id: 'dropoff-loc-final',
                    position: { lat: ride.dropoffs[ride.dropoffs.length - 1].latitude, lng: ride.dropoffs[ride.dropoffs.length - 1].longitude },
                    icon: `📍 ${String.fromCharCode(66 + ride.dropoffs.length - 1)}`,
                    size: [28, 28],
                }
            ];
        } else if (ride?.dropoff) {
            return [{
                id: 'dropoff-loc',
                position: { lat: ride.dropoff.latitude, lng: ride.dropoff.longitude },
                icon: '📍 B',
                size: [28, 28],
            }];
        }
        return [];
    };

    const renderPickupMarker = () => {
        if (!ride?.pickup) return [];
        return [{
            id: 'pickup-loc',
            position: { lat: ride.pickup.latitude, lng: ride.pickup.longitude },
            icon: '📍 A',
            size: [28, 28],
        }];
    };

    return (
        <View style={styles.container}>
            {/* Map */}
            {destination && (
                <View style={styles.map}>
                    <LeafletView
                        ref={mapRef}
                        zoomControl={false}
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
                            ...renderPickupMarker(),
                            ...renderDropoffMarkers()
                        ]}
                        mapShapes={routeCoords.length > 0 ? [{
                            shapeType: 'Polyline',
                            color: COLORS.accent,
                            id: 'route-line',
                            positions: routeCoords,
                            weight: 5,
                            opacity: 0.8
                        }] : []}
                    />
                </View>
            )}

            {/* Background elements */}
            <View style={styles.bgOverlay}>
                <Animated.View style={[styles.bgCircle1, { opacity: glowAnim }]} />
                <Animated.View style={[styles.bgCircle2, { opacity: glowAnim }]} />
            </View>

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
                <Animated.View style={[
                    styles.statusRow,
                    { borderLeftColor: statusInfo.color, transform: [{ scale: breatheAnim }] }
                ]}>
                    <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                    <Text style={styles.statusLabel}>{statusInfo.label}</Text>
                </Animated.View>

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
                            {ride?.status === 'in_progress' ? 'Destino Final' : 'Punto de recogida'}
                        </Text>
                        <Text style={styles.navAddress} numberOfLines={2}>
                            {ride?.status === 'in_progress' && ride?.dropoffs && ride.dropoffs.length > 1
                                ? `${ride.dropoffs.length - 1} Paradas + Destino: ${destination?.name || 'Cargando...'}`
                                : (destination?.name || 'Cargando dirección...')}
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

            <RatingModal
                visible={showRatingModal}
                type="rider"
                onFinish={handleFinishRating}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    bgOverlay: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
    },
    bgCircle1: {
        position: 'absolute',
        width: scale(150),
        height: scale(150),
        borderRadius: scale(75),
        backgroundColor: COLORS.neonBlue + '20',
        top: SAFE_TOP,
        right: scale(-20),
    },
    bgCircle2: {
        position: 'absolute',
        width: scale(120),
        height: scale(120),
        borderRadius: scale(60),
        backgroundColor: COLORS.neonPurple + '15',
        top: scale(150),
        left: scale(-30),
    },
    backBtn: {
        position: 'absolute',
        top: SAFE_TOP,
        left: scale(SPACING.md),
        backgroundColor: 'rgba(13, 17, 23, 0.7)',
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        zIndex: 10,
    },
    backBtnText: {
        fontSize: moderateScale(22),
        color: COLORS.textPrimary,
    },
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.bgOverlay,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        padding: SPACING.lg,
        paddingBottom: SAFE_BOTTOM + SPACING.md,
        borderTopWidth: 1.5,
        borderColor: COLORS.glassBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.5,
        shadowRadius: scale(10),
        elevation: 10,
        zIndex: 2,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(SPACING.sm),
        borderLeftWidth: 4,
        paddingLeft: scale(SPACING.sm),
        marginBottom: scale(SPACING.md),
    },
    statusIcon: {
        fontSize: moderateScale(22),
    },
    statusLabel: {
        fontSize: moderateScale(18),
        fontWeight: '900',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    riderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(SPACING.md),
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: scale(SPACING.md),
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    riderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(SPACING.sm),
    },
    riderAvatar: {
        fontSize: moderateScale(32),
        textShadowColor: COLORS.neonBlue,
        textShadowRadius: scale(10),
    },
    riderName: {
        fontSize: moderateScale(FONTS.sizes.md),
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    riderPhone: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    ridePriceBox: {
        alignItems: 'flex-end',
    },
    ridePriceLabel: {
        fontSize: moderateScale(10),
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        fontWeight: '800',
    },
    ridePrice: {
        fontSize: moderateScale(20),
        fontWeight: '950',
        color: COLORS.neonGreen,
        textShadowColor: COLORS.neonGreen + '50',
        textShadowRadius: scale(10),
    },
    navCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: RADIUS.lg,
        padding: scale(SPACING.md),
        gap: scale(SPACING.sm),
        marginBottom: scale(SPACING.lg),
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    navIcon: {
        fontSize: moderateScale(24),
    },
    navInfo: {
        flex: 1,
    },
    navLabel: {
        fontSize: moderateScale(10),
        color: COLORS.textMuted,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    navAddress: {
        fontSize: moderateScale(15),
        color: COLORS.textPrimary,
        fontWeight: '600',
        marginTop: scale(2),
    },
    actionBtn: {
        borderRadius: RADIUS.full,
        paddingVertical: scale(18),
        alignItems: 'center',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: scale(15),
        elevation: 8,
    },
    actionBtnText: {
        fontSize: moderateScale(18),
        fontWeight: '950',
        color: '#000',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
});
