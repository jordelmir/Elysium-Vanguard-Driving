import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { CARTO_DARK_TILES } from './RiderDashboard';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { scale, moderateScale, SAFE_TOP, SAFE_BOTTOM } from '../../theme/responsive';
import RatingModal from '../../components/RatingModal';
import { getRoute } from '../../lib/geo';

export default function RideTracking({ route, navigation }) {
    const { rideId, driverId } = route.params;
    const mapRef = useRef(null);
    const [ride, setRide] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [driverInfo, setDriverInfo] = useState(null);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [routeCoords, setRouteCoords] = useState([]);
    const [eta, setEta] = useState(null);

    // Listen for ride updates
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
                            console.error("Failed to fetch route for tracking", e);
                        }
                    }
                }

                if (data.status === 'completed' && !showRatingModal) {
                    setShowRatingModal(true);
                }
            }
        });
        return unsubscribe;
    }, [rideId, showRatingModal, routeCoords.length]);

    const handleFinishRating = async (rating) => {
        try {
            // Update driver rating
            if (driverId) {
                await updateDoc(doc(db, 'users', driverId), {
                    ratingSum: increment(rating),
                    ratingCount: increment(1),
                    totalRides: increment(1),
                });
            }

            setShowRatingModal(false);
            Alert.alert('🎉 ¡Viaje completado!', `Total: ₡${ride?.acceptedPrice || ride?.proposedPrice}`);
            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo guardar la calificación');
            navigation.goBack();
        }
    };

    // Listen for driver location
    useEffect(() => {
        if (!driverId) return;
        const unsubscribe = onSnapshot(doc(db, 'drivers', driverId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.location) {
                    setDriverLocation(data.location);
                }
                setDriverInfo(data.vehicle);
            }
        });
        return unsubscribe;
    }, [driverId]);

    // Calculate ETA
    useEffect(() => {
        if (!driverLocation || !ride) return;

        const calculateETA = async () => {
            try {
                let targetLoc;
                if (ride.status === 'accepted' || ride.status === 'arriving') {
                    targetLoc = ride.pickup;
                } else if (ride.status === 'in_progress') {
                    const dropoffsArray = ride.dropoffs || [];
                    targetLoc = dropoffsArray.length > 0 ? dropoffsArray[dropoffsArray.length - 1] : ride.dropoff;
                }

                if (targetLoc && targetLoc.latitude) {
                    const route = await getRoute([
                        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                        { latitude: targetLoc.latitude, longitude: targetLoc.longitude }
                    ]);
                    if (route) {
                        setEta(Math.ceil(route.duration));
                    }
                }
            } catch (err) {
                console.error("ETA Calculation Error:", err);
            }
        };

        const timer = setTimeout(calculateETA, 2000); // Debounce to avoid excessive API calls
        return () => clearTimeout(timer);
    }, [driverLocation, ride?.status]);

    const getStatusLabel = () => {
        switch (ride?.status) {
            case 'accepted': return { text: 'Chofer en camino', color: COLORS.info, icon: '🚗' };
            case 'arriving': return { text: 'Llegando a tu ubicación', color: COLORS.warning, icon: '📍' };
            case 'in_progress': return { text: 'En viaje', color: COLORS.success, icon: '🛣️' };
            default: return { text: 'Buscando chofer...', color: COLORS.textMuted, icon: '⏳' };
        }
    };

    const status = getStatusLabel();

    return (
        <View style={styles.container}>
            {/* Map */}
            {ride?.pickup && (
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
                            lat: ride.pickup.latitude,
                            lng: ride.pickup.longitude
                        }}
                        mapMarkers={[
                            ...(driverLocation ? [{
                                id: 'driver-loc',
                                position: { lat: driverLocation.latitude, lng: driverLocation.longitude },
                                icon: '🚗',
                                size: [32, 32],
                            }] : []),
                            ...(ride?.pickup ? [{
                                id: 'pickup-loc',
                                position: { lat: ride.pickup.latitude, lng: ride.pickup.longitude },
                                icon: '📍 A',
                                size: [28, 28],
                            }] : []),
                            ...((ride?.dropoffs || []).slice(0, -1).map((stop, idx) => ({
                                id: `stop-${idx}`,
                                position: { lat: stop.latitude, lng: stop.longitude },
                                icon: `📍 ${String.fromCharCode(66 + idx)}`,
                                size: [24, 24],
                            }))),
                            ...(() => {
                                const dropoffsArray = ride?.dropoffs || [];
                                const finalDest = dropoffsArray.length > 0 ? dropoffsArray[dropoffsArray.length - 1] : ride?.dropoff;
                                return finalDest ? [{
                                    id: 'dropoff-loc',
                                    position: { lat: finalDest.latitude, lng: finalDest.longitude },
                                    icon: `📍 ${String.fromCharCode(66 + Math.max(0, dropoffsArray.length - 1))}`,
                                    size: [28, 28],
                                }] : [];
                            })()
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

            {/* Back button */}
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>

            {/* Bottom info card */}
            <View style={styles.bottomCard}>
                {/* Status indicator */}
                <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={styles.statusIcon}>{status.icon}</Text>
                    <Text style={[styles.statusText, { color: status.color }]}>
                        {status.text} {eta ? `(${eta} min)` : ''}
                    </Text>
                </View>

                {/* Driver info */}
                {driverInfo && (
                    <View style={styles.driverInfoRow}>
                        <View style={styles.driverAvatar}>
                            <Text style={{ fontSize: moderateScale(28) }}>👤</Text>
                        </View>
                        <View style={styles.driverDetails}>
                            <Text style={styles.driverName}>{ride?.driverName || 'Chofer'}</Text>
                            <Text style={styles.vehicleInfo}>
                                {driverInfo.make} {driverInfo.model} · {driverInfo.color}
                            </Text>
                            <Text style={styles.plateText}>{driverInfo.plate}</Text>
                        </View>
                        <View style={styles.priceTag}>
                            <Text style={styles.priceLabel}>Precio</Text>
                            <Text style={styles.priceValue}>
                                ₡{(ride?.acceptedPrice || ride?.proposedPrice || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Payment method */}
                <View style={styles.paymentRow}>
                    <Text style={styles.paymentIcon}>
                        {ride?.paymentMethod === 'sinpe' ? '📱' : '💵'}
                    </Text>
                    <Text style={styles.paymentText}>
                        Pago: {ride?.paymentMethod === 'sinpe' ? 'SINPE Móvil' : 'Efectivo'}
                    </Text>
                </View>
            </View>

            <RatingModal
                visible={showRatingModal}
                type="driver"
                onFinish={handleFinishRating}
            />
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
    driverPin: {},
    pickupPin: {},
    dropoffPin: {},
    backBtn: {
        position: 'absolute',
        top: SAFE_TOP,
        left: scale(SPACING.md),
        backgroundColor: COLORS.bgOverlay,
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backBtnText: {
        fontSize: moderateScale(22),
        color: COLORS.textPrimary,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.bgSecondary,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        padding: scale(SPACING.lg),
        paddingBottom: SAFE_BOTTOM + scale(SPACING.md),
        borderTopWidth: 1,
        borderColor: COLORS.border,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: scale(SPACING.md),
        paddingVertical: scale(SPACING.sm),
        borderRadius: RADIUS.full,
        marginBottom: scale(SPACING.md),
        gap: scale(SPACING.xs),
    },
    statusIcon: {
        fontSize: moderateScale(16),
    },
    statusText: {
        fontSize: moderateScale(FONTS.sizes.md),
        fontWeight: '700',
    },
    driverInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(SPACING.md),
        gap: scale(SPACING.md),
    },
    driverAvatar: {
        width: scale(56),
        height: scale(56),
        borderRadius: scale(28),
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    driverDetails: {
        flex: 1,
    },
    driverName: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    vehicleInfo: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textSecondary,
        marginTop: scale(2),
    },
    plateText: {
        fontSize: moderateScale(FONTS.sizes.sm),
        fontWeight: '700',
        color: COLORS.accent,
        marginTop: scale(2),
    },
    priceTag: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: scale(SPACING.sm),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    priceLabel: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
    },
    priceValue: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '800',
        color: COLORS.accent,
    },
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: scale(SPACING.md),
        gap: scale(SPACING.sm),
    },
    paymentIcon: {
        fontSize: moderateScale(20),
    },
    paymentText: {
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
});
