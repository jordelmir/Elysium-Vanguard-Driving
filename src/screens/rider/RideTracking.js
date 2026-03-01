import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { CARTO_DARK_TILES } from './RiderDashboard';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import RatingModal from '../../components/RatingModal';

// Dark map style removed as CARTO_DARK_TILES will be used in WebViewLeaflet

export default function RideTracking({ route, navigation }) {
    const { rideId, driverId } = route.params;
    const mapRef = useRef(null);

    const [ride, setRide] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [driverInfo, setDriverInfo] = useState(null);
    const [showRatingModal, setShowRatingModal] = useState(false);

    // Listen for ride updates
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'rides', rideId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRide(data);
                if (data.status === 'completed' && !showRatingModal) {
                    setShowRatingModal(true);
                }
            }
        });
        return unsubscribe;
    }, [rideId, showRatingModal]);

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
                        zoom={16}
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
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                </View>

                {/* Driver info */}
                {driverInfo && (
                    <View style={styles.driverInfoRow}>
                        <View style={styles.driverAvatar}>
                            <Text style={{ fontSize: 28 }}>👤</Text>
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
    bottomCard: {
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
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        marginBottom: SPACING.md,
        gap: SPACING.xs,
    },
    statusIcon: {
        fontSize: 16,
    },
    statusText: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
    },
    driverInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        gap: SPACING.md,
    },
    driverAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
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
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    vehicleInfo: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    plateText: {
        fontSize: FONTS.sizes.sm,
        fontWeight: '700',
        color: COLORS.accent,
        marginTop: 2,
    },
    priceTag: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    priceLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
    },
    priceValue: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '800',
        color: COLORS.accent,
    },
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    paymentIcon: {
        fontSize: 20,
    },
    paymentText: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
});
