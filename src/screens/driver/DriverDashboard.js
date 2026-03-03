import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions,
    StatusBar, FlatList, Alert, Platform, Animated,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { CARTO_DARK_TILES } from '../rider/RiderDashboard';
import { useAuth, calculateRatingPercentage } from '../../context/AuthContext';
import { getCurrentLocation, watchLocation, calculateDistance } from '../../lib/geo';
import { formatPrice, calculateCommission } from '../../lib/pricing';
import { db } from '../../lib/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc, GeoPoint,
} from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';

import { scale, moderateScale, SCREEN_WIDTH, DEVICE_SIZE, SAFE_TOP, SAFE_BOTTOM } from '../../theme/responsive';

const { width } = Dimensions.get('window');

// Dark map style removed as CARTO_DARK_TILES will be used in WebViewLeaflet

export default function DriverDashboard({ navigation }) {
    const { user, userData, logout } = useAuth();
    const mapRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const [myLocation, setMyLocation] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [rideRequests, setRideRequests] = useState([]);
    const [todayEarnings, setTodayEarnings] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const breatheAnim = useRef(new Animated.Value(0.6)).current;

    // Breathing animation for online status
    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(breatheAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(breatheAnim, {
                    toValue: 0.6,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    // Pulse animation for connect button
    useEffect(() => {
        if (!isOnline) return;
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [isOnline]);

    // Track GPS and update Firestore
    useEffect(() => {
        let subscription;

        (async () => {
            try {
                const loc = await getCurrentLocation();
                setMyLocation(loc);

                if (isOnline && user) {
                    // Start continuous tracking
                    subscription = await watchLocation(async (location) => {
                        setMyLocation(location);
                        // Update driver location in Firestore
                        try {
                            await updateDoc(doc(db, 'drivers', user.uid), {
                                location: new GeoPoint(location.latitude, location.longitude),
                            });
                        } catch (e) {
                            // Silently fail - driver doc might not exist yet
                        }
                    });
                }
            } catch (err) {
                Alert.alert('GPS', 'Necesitamos acceso a tu ubicación');
            }
        })();

        return () => {
            if (subscription) subscription.remove();
        };
    }, [isOnline, user]);

    // Listen for pending ride requests near me
    useEffect(() => {
        if (!isOnline) {
            setRideRequests([]);
            return;
        }

        const q = query(
            collection(db, 'rides'),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const requests = [];

            // We need to fetch rider details for each request to show ratings
            const promises = snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();

                // Fetch rider info
                let riderRating = 100;
                let riderTrips = 0;
                try {
                    const riderDoc = await getDoc(doc(db, 'users', data.riderId));
                    if (riderDoc.exists()) {
                        const rData = riderDoc.data();
                        riderRating = calculateRatingPercentage(rData.ratingSum, rData.ratingCount);
                        riderTrips = rData.totalRides || 0;
                    }
                } catch (e) { }

                if (myLocation && data.pickup) {
                    const dist = calculateDistance(
                        myLocation.latitude, myLocation.longitude,
                        data.pickup.latitude, data.pickup.longitude
                    );
                    if (dist <= 10) {
                        requests.push({
                            id: docSnap.id,
                            ...data,
                            distanceToPickup: dist,
                            riderRating,
                            riderTrips,
                        });
                    }
                } else {
                    requests.push({
                        id: docSnap.id,
                        ...data,
                        distanceToPickup: null,
                        riderRating,
                        riderTrips
                    });
                }
            });

            await Promise.all(promises);
            // Sort by distance
            requests.sort((a, b) => (a.distanceToPickup || 999) - (b.distanceToPickup || 999));
            setRideRequests(requests);
        });

        return unsubscribe;
    }, [isOnline, myLocation]);

    // Toggle online/offline
    const toggleOnline = async () => {
        const newStatus = !isOnline;
        setIsOnline(newStatus);

        if (user) {
            try {
                await updateDoc(doc(db, 'drivers', user.uid), {
                    isOnline: newStatus,
                    location: myLocation ? new GeoPoint(myLocation.latitude, myLocation.longitude) : null,
                });
            } catch (e) {
                // Driver document might not exist yet
            }
        }
    };

    // Accept a ride
    const acceptRide = async (ride) => {
        try {
            await updateDoc(doc(db, 'rides', ride.id), {
                driverId: user.uid,
                driverName: userData?.name || 'Chofer',
                status: 'accepted',
                acceptedPrice: ride.proposedPrice,
            });

            await updateDoc(doc(db, 'drivers', user.uid), {
                currentRideId: ride.id,
            });

            navigation.navigate('ActiveRide', { rideId: ride.id });
        } catch (error) {
            Alert.alert('Error', 'No se pudo aceptar el viaje');
        }
    };

    const renderRideRequest = ({ item }) => {
        const { commission, driverEarns } = calculateCommission(item.proposedPrice);

        return (
            <View style={styles.requestCard}>
                <View style={styles.requestHeader}>
                    <View style={styles.riderInfo}>
                        <Text style={styles.riderAvatar}>👤</Text>
                        <View>
                            <Text style={styles.riderName}>{item.riderName}</Text>
                            <View style={styles.riderMetrics}>
                                <Text style={[
                                    styles.riderRatingText,
                                    { color: item.riderRating >= 70 ? COLORS.success : COLORS.error }
                                ]}>
                                    ⭐ {item.riderRating}%
                                </Text>
                                <Text style={styles.riderTripsBadge}>
                                    {item.riderTrips} viajes
                                </Text>
                            </View>
                            {item.distanceToPickup && (
                                <Text style={styles.distanceText}>
                                    📍 {item.distanceToPickup.toFixed(1)} km de ti
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.priceBox}>
                        <Text style={styles.proposedPrice}>{formatPrice(item.proposedPrice)}</Text>
                        <Text style={styles.earningsText}>
                            Ganas: {formatPrice(driverEarns)}
                        </Text>
                    </View>
                </View>

                <View style={styles.routeInfo}>
                    <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.routeText} numberOfLines={1}>
                            {item.pickup?.name || 'Origen'}
                        </Text>
                    </View>
                    <View style={styles.routeLine} />
                    {item.dropoffs && item.dropoffs.length > 1 ? (
                        <View style={styles.routeRow}>
                            <View style={[styles.routeDot, { backgroundColor: COLORS.warning }]} />
                            <Text style={styles.routeText} numberOfLines={1}>
                                {item.dropoffs.length - 1} Parada{item.dropoffs.length > 2 ? 's' : ''} + Destino ({item.dropoffs[item.dropoffs.length - 1].name})
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.routeRow}>
                            <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
                            <Text style={styles.routeText} numberOfLines={1}>
                                {item.dropoffs?.[0]?.name || item.dropoff?.name || 'Destino'}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.requestFooter}>
                    <View style={styles.paymentTag}>
                        <Text style={styles.paymentEmoji}>
                            {item.paymentMethod === 'sinpe' ? '📱' : '💵'}
                        </Text>
                        <Text style={styles.paymentLabel}>
                            {item.paymentMethod === 'sinpe' ? 'SINPE' : 'Efectivo'}
                        </Text>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => acceptRide(item)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.acceptBtnText}>Aceptar ✓</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.commissionNote}>
                    Comisión Elysium Vanguard Driving: solo {formatPrice(commission)} (1%)
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Map */}
            {myLocation && (
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
                            lat: myLocation.latitude,
                            lng: myLocation.longitude
                        }}
                        zoom={15}
                        mapMarkers={[
                            // Driver location
                            {
                                id: 'driver-loc',
                                position: { lat: myLocation.latitude, lng: myLocation.longitude },
                                icon: '🚗',
                                size: [32, 32],
                            },
                            // Ride requests pickups
                            ...rideRequests.map(r => ({
                                id: `req-${r.id}`,
                                position: { lat: r.pickup.latitude, lng: r.pickup.longitude },
                                icon: '🙋‍♂️',
                                size: [32, 32],
                            }))
                        ]}
                    />
                </View>
            )}

            {/* Header & Stats */}
            <View style={styles.headerAbsolute}>
                <View style={styles.topBar}>
                    <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(!showMenu)}>
                        <Text style={styles.menuIcon}>☰</Text>
                    </TouchableOpacity>

                    {isOnline && (
                        <Animated.View style={[styles.onlineBadge, { opacity: breatheAnim }]}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>En línea</Text>
                        </Animated.View>
                    )}
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statEmoji}>💰</Text>
                        <View>
                            <Text style={styles.statValue}>₡{todayEarnings.toLocaleString()}</Text>
                            <Text style={styles.statLabel}>Hoy</Text>
                        </View>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statEmoji}>📋</Text>
                        <View>
                            <Text style={styles.statValue}>{userData?.totalRides || 0}</Text>
                            <Text style={styles.statLabel}>Viajes</Text>
                        </View>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statEmoji}>⭐</Text>
                        <View>
                            <Text style={styles.statValue}>{calculateRatingPercentage(userData?.ratingSum, userData?.ratingCount)}%</Text>
                            <Text style={styles.statLabel}>Ranking</Text>
                        </View>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statEmoji}>💎</Text>
                        <View>
                            <Text style={styles.statValue}>1%</Text>
                            <Text style={styles.statLabel}>Comisión</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Ride requests list */}
            {isOnline && rideRequests.length > 0 && (
                <View style={styles.requestsContainer}>
                    <Text style={styles.requestsTitle}>
                        🔔 {rideRequests.length} solicitud{rideRequests.length !== 1 ? 'es' : ''} cerca
                    </Text>
                    <FlatList
                        data={rideRequests}
                        renderItem={renderRideRequest}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.requestsList}
                        snapToInterval={width - 48}
                        decelerationRate="fast"
                    />
                </View>
            )}

            {/* Connect button */}
            <View style={styles.bottomSection}>
                {isOnline && rideRequests.length === 0 && (
                    <View style={styles.waitingCard}>
                        <Text style={styles.waitingIcon}>📡</Text>
                        <Text style={styles.waitingText}>Esperando solicitudes de viajes cercanos...</Text>
                    </View>
                )}

                <View style={styles.connectRow}>
                    <TouchableOpacity style={styles.settingsBtn}>
                        <Text style={{ fontSize: 22 }}>⚙️</Text>
                    </TouchableOpacity>

                    <Animated.View style={{ transform: [{ scale: isOnline ? pulseAnim : 1 }], flex: 1 }}>
                        <TouchableOpacity
                            style={[styles.connectBtn, isOnline && styles.connectBtnOnline]}
                            onPress={toggleOnline}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.connectBtnText, isOnline && styles.connectBtnTextOnline]}>
                                {isOnline ? 'Desconectarse' : 'Conectarse'}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>

            {/* Menu overlay */}
            {showMenu && (
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={styles.menuContent}>
                        <View style={styles.menuHeader}>
                            <View style={styles.userAvatarLarge}>
                                <Text style={{ fontSize: 40 }}>👤</Text>
                            </View>
                            <Text style={styles.menuUserName}>{userData?.name || 'Chofer'}</Text>

                            <View style={styles.ratingBadgeContainer}>
                                <Text style={[
                                    styles.ratingPercent,
                                    { color: calculateRatingPercentage(userData?.ratingSum, userData?.ratingCount) >= 70 ? COLORS.success : COLORS.error }
                                ]}>
                                    {calculateRatingPercentage(userData?.ratingSum, userData?.ratingCount)}% Calificación
                                </Text>
                                {calculateRatingPercentage(userData?.ratingSum, userData?.ratingCount) >= 70 && (
                                    <View style={styles.recommendedBadge}>
                                        <Text style={styles.recommendedText}>⭐ RECOMENDADO</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.userTrips}>{userData?.totalRides || 0} viajes completados</Text>
                        </View>

                        <View style={styles.menuItems}>
                            <TouchableOpacity style={styles.menuItem}>
                                <Text style={styles.menuItemIcon}>📋</Text>
                                <Text style={styles.menuItemText}>Mis Viajes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem}>
                                <Text style={styles.menuItemIcon}>💰</Text>
                                <Text style={styles.menuItemText}>Ganancias</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem}>
                                <Text style={styles.menuItemIcon}>🚙</Text>
                                <Text style={styles.menuItemText}>Vehículo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.menuItem, { marginTop: 'auto' }]}
                                onPress={logout}
                            >
                                <Text style={[styles.menuItemIcon, { color: COLORS.error }]}>🚪</Text>
                                <Text style={[styles.menuItemText, { color: COLORS.error }]}>Cerrar Sesión</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            )}
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
    headerAbsolute: {
        position: 'absolute',
        top: SAFE_TOP + scale(5),
        left: scale(SPACING.md),
        right: scale(SPACING.md),
        zIndex: 10,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(SPACING.sm),
    },
    menuBtn: {
        backgroundColor: COLORS.glassBgDark,
        width: scale(44),
        height: scale(44),
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    menuIcon: {
        fontSize: moderateScale(22),
        color: COLORS.neonBlue,
        textShadowColor: COLORS.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: scale(10),
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(SPACING.xs),
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: scale(SPACING.xs),
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    statItem: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glassBgDark,
        padding: scale(SPACING.sm),
        borderRadius: RADIUS.md,
        gap: scale(SPACING.sm),
    },
    statEmoji: { fontSize: moderateScale(16) },
    statValue: {
        fontSize: moderateScale(14),
        fontWeight: '800',
        color: COLORS.neonBlue,
    },
    statLabel: {
        fontSize: moderateScale(9),
        color: COLORS.textMuted,
        textTransform: 'uppercase',
    },
    onlineBadge: {
        backgroundColor: COLORS.successBg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(SPACING.sm),
        paddingVertical: scale(6),
        borderRadius: RADIUS.full,
        gap: scale(6),
        borderWidth: 1,
        borderColor: COLORS.success + '40',
    },
    onlineDot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
        backgroundColor: COLORS.success,
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: scale(5),
    },
    onlineText: {
        fontSize: moderateScale(10),
        fontWeight: '800',
        color: COLORS.success,
        textTransform: 'uppercase',
    },
    requestsContainer: {
        position: 'absolute',
        bottom: scale(130),
        left: 0,
        right: 0,
    },
    requestsTitle: {
        fontSize: FONTS.sizes.sm,
        fontWeight: '800',
        color: COLORS.textPrimary,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    requestsList: {
        paddingHorizontal: scale(SPACING.md),
        gap: scale(SPACING.sm),
    },
    requestCard: {
        width: DEVICE_SIZE.TABLET || DEVICE_SIZE.DESKTOP ? (SCREEN_WIDTH / 2) - scale(32) : SCREEN_WIDTH - scale(48),
        backgroundColor: COLORS.glassBgDark,
        borderRadius: RADIUS.xl,
        padding: scale(SPACING.md),
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        marginRight: scale(SPACING.sm),
        overflow: 'hidden',
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
    },
    riderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    riderAvatar: {
        fontSize: 28,
    },
    riderName: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    distanceText: {
        fontSize: 11,
        color: COLORS.neonPurple,
        fontWeight: '600',
    },
    priceBox: {
        alignItems: 'flex-end',
    },
    proposedPrice: {
        fontSize: moderateScale(FONTS.sizes.xl),
        fontWeight: '900',
        color: COLORS.neonBlue,
        textShadowColor: COLORS.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: scale(10),
    },
    earningsText: {
        fontSize: moderateScale(10),
        color: COLORS.success,
        fontWeight: '700',
        marginTop: scale(2),
    },
    routeInfo: {
        marginBottom: SPACING.md,
        paddingLeft: SPACING.xs,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    routeDot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    routeText: {
        fontSize: moderateScale(13),
        color: COLORS.textSecondary,
        flex: 1,
    },
    routeLine: {
        width: 1,
        height: scale(12),
        backgroundColor: COLORS.glassBorder,
        marginLeft: scale(3.5),
        marginVertical: scale(2),
    },
    requestFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.glassBorder,
    },
    paymentTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: RADIUS.sm,
        paddingHorizontal: scale(8),
        paddingVertical: scale(4),
        gap: scale(4),
    },
    paymentEmoji: {
        fontSize: moderateScale(12),
    },
    paymentLabel: {
        fontSize: moderateScale(10),
        color: COLORS.textMuted,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    acceptBtn: {
        backgroundColor: COLORS.neonBlue,
        borderRadius: RADIUS.md,
        paddingHorizontal: scale(SPACING.lg),
        paddingVertical: scale(10),
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: scale(10),
        elevation: 10,
    },
    acceptBtnText: {
        fontSize: moderateScale(14),
        fontWeight: '900',
        color: COLORS.bgPrimary,
        textTransform: 'uppercase',
    },
    commissionNote: {
        fontSize: moderateScale(9),
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: scale(SPACING.sm),
        opacity: 0.7,
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.md,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    waitingCard: {
        backgroundColor: COLORS.glassBgDark,
        borderRadius: RADIUS.lg,
        padding: scale(SPACING.md),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(SPACING.sm),
        marginBottom: scale(SPACING.md),
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    waitingIcon: {
        fontSize: moderateScale(22),
    },
    waitingText: {
        fontSize: moderateScale(12),
        color: COLORS.textSecondary,
        flex: 1,
        fontWeight: '500',
    },
    connectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    settingsBtn: {
        backgroundColor: COLORS.glassBgDark,
        width: scale(56),
        height: scale(56),
        borderRadius: scale(28),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    connectBtn: {
        backgroundColor: 'transparent',
        borderRadius: RADIUS.full,
        paddingVertical: scale(18),
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.neonBlue,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: scale(5),
    },
    connectBtnOnline: {
        backgroundColor: COLORS.neonBlue,
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },
    connectBtnText: {
        fontSize: moderateScale(16),
        fontWeight: '900',
        color: COLORS.neonBlue,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    connectBtnTextOnline: {
        color: COLORS.bgPrimary,
    },
    riderMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(SPACING.xs),
        marginTop: scale(2),
    },
    riderRatingText: {
        fontSize: moderateScale(11),
        fontWeight: '800',
    },
    riderTripsBadge: {
        fontSize: moderateScale(9),
        color: COLORS.textMuted,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: scale(5),
        paddingVertical: scale(1),
        borderRadius: scale(4),
    },
    // Menu
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    menuContent: {
        width: DEVICE_SIZE.TABLET || DEVICE_SIZE.DESKTOP ? scale(300) : width * 0.8,
        height: '100%',
        backgroundColor: COLORS.bgPrimary,
        borderRightWidth: 1,
        borderRightColor: COLORS.neonBlue + '40',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    menuHeader: {
        padding: SPACING.xl,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.glassBorder,
    },
    userAvatarLarge: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(50),
        backgroundColor: COLORS.glassBgDark,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(SPACING.md),
        borderWidth: 2,
        borderColor: COLORS.neonBlue,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    menuUserName: {
        fontSize: moderateScale(22),
        fontWeight: '900',
        color: COLORS.textPrimary,
        marginBottom: scale(SPACING.xs),
    },
    ratingBadgeContainer: {
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    ratingPercent: {
        fontSize: moderateScale(16),
        fontWeight: '800',
    },
    recommendedBadge: {
        backgroundColor: COLORS.success + '20',
        paddingHorizontal: scale(12),
        paddingVertical: scale(4),
        borderRadius: scale(4),
        marginTop: scale(6),
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    recommendedText: {
        fontSize: moderateScale(10),
        color: COLORS.success,
        fontWeight: '900',
    },
    userTrips: {
        fontSize: moderateScale(12),
        color: COLORS.textMuted,
        marginTop: scale(4),
    },
    menuItems: {
        flex: 1,
        padding: SPACING.lg,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        gap: SPACING.md,
    },
    menuItemIcon: {
        fontSize: moderateScale(24),
    },
    menuItemText: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
});
