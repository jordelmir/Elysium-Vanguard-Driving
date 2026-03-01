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

            {/* Top bar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(!showMenu)}>
                    <Text style={styles.menuIcon}>☰</Text>
                </TouchableOpacity>

                <View style={styles.earningsBadge}>
                    <Text style={styles.earningsAmount}>₡{todayEarnings.toLocaleString()}</Text>
                    <Text style={styles.earningsLabel}>Hoy</Text>
                </View>

                {isOnline && (
                    <View style={styles.onlineBadge}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>En línea</Text>
                    </View>
                )}
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

                    <TouchableOpacity style={styles.settingsBtn} onPress={logout}>
                        <Text style={{ fontSize: 22 }}>🚪</Text>
                    </TouchableOpacity>
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
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 40,
        left: SPACING.md,
        right: SPACING.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    menuBtn: {
        backgroundColor: COLORS.bgOverlay,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    menuIcon: {
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    earningsBadge: {
        backgroundColor: COLORS.bgOverlay,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    earningsAmount: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '800',
        color: COLORS.accent,
    },
    earningsLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
    },
    onlineBadge: {
        backgroundColor: COLORS.successBg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADIUS.full,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(63, 185, 80, 0.3)',
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.success,
    },
    onlineText: {
        fontSize: FONTS.sizes.xs,
        fontWeight: '700',
        color: COLORS.success,
    },
    requestsContainer: {
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
    },
    requestsTitle: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    requestsList: {
        paddingHorizontal: SPACING.md,
        gap: SPACING.sm,
    },
    requestCard: {
        width: width - 48,
        backgroundColor: COLORS.bgSecondary,
        borderRadius: RADIUS.xl,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
        marginRight: SPACING.sm,
    },
    requestHeader: {
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
        fontSize: 28,
    },
    riderName: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    distanceText: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    priceBox: {
        alignItems: 'flex-end',
    },
    proposedPrice: {
        fontSize: FONTS.sizes.xl,
        fontWeight: '800',
        color: COLORS.accent,
    },
    earningsText: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.success,
        fontWeight: '600',
    },
    routeInfo: {
        marginBottom: SPACING.md,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    routeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    routeText: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        flex: 1,
    },
    routeLine: {
        width: 2,
        height: 16,
        backgroundColor: COLORS.border,
        marginLeft: 4,
        marginVertical: 2,
    },
    requestFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        gap: 4,
    },
    paymentEmoji: {
        fontSize: 14,
    },
    paymentLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    acceptBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 10,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    acceptBtnText: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: '#ffffff',
    },
    commissionNote: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.sm,
        fontStyle: 'italic',
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.md,
        paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
    },
    waitingCard: {
        backgroundColor: COLORS.bgOverlay,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    waitingIcon: {
        fontSize: 22,
    },
    waitingText: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        flex: 1,
    },
    connectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    settingsBtn: {
        backgroundColor: COLORS.bgOverlay,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    connectBtn: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.full,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    connectBtnOnline: {
        backgroundColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
    },
    connectBtnText: {
        fontSize: FONTS.sizes.xl,
        fontWeight: '800',
        color: COLORS.accent,
    },
    connectBtnTextOnline: {
        color: '#ffffff',
    },
    riderMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: 2,
    },
    riderRatingText: {
        fontSize: 12,
        fontWeight: '700',
    },
    riderTripsBadge: {
        fontSize: 10,
        color: COLORS.textMuted,
        backgroundColor: COLORS.bgPrimary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    // Menu
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContent: {
        width: width * 0.8,
        height: '100%',
        backgroundColor: COLORS.bgSecondary,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    menuHeader: {
        padding: SPACING.xl,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        backgroundColor: COLORS.bgCard,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    userAvatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    menuUserName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    ratingBadgeContainer: {
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    ratingPercent: {
        fontSize: 16,
        fontWeight: '700',
    },
    recommendedBadge: {
        backgroundColor: COLORS.success + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 4,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    recommendedText: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.success,
    },
    userTrips: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    menuItems: {
        padding: SPACING.lg,
        flex: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    menuItemIcon: {
        fontSize: 22,
        marginRight: SPACING.md,
    },
    menuItemText: {
        fontSize: 16,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
});
