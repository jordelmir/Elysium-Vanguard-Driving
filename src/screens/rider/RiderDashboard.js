import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions,
    StatusBar, TextInput, Modal, Alert, Animated, Platform,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { useAuth } from '../../context/AuthContext';
import { getCurrentLocation, watchLocation, calculateDistance, reverseGeocode } from '../../lib/geo';
import { calculateSuggestedPrice, generatePriceSuggestions, formatPrice } from '../../lib/pricing';
import { db } from '../../lib/firebase';
import {
    collection, query, where, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

// OSM default style doesn't have a direct dark mode via URL easily without registration,
// but we can use CartoDB Dark Matter tiles which are free and don't require API keys.
export const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export default function RiderDashboard({ navigation }) {
    const { user, userData, logout } = useAuth();
    const mapRef = useRef(null);
    const slideAnim = useRef(new Animated.Value(0)).current;

    const [myLocation, setMyLocation] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [showPanel, setShowPanel] = useState(false);
    const [destination, setDestination] = useState(null);
    const [destinationName, setDestinationName] = useState('');
    const [pickupName, setPickupName] = useState('');
    const [selectedPrice, setSelectedPrice] = useState(0);
    const [customPrice, setCustomPrice] = useState('');
    const [priceSuggestions, setPriceSuggestions] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [showMenu, setShowMenu] = useState(false);
    const [rideStatus, setRideStatus] = useState(null); // null, 'searching', 'found'

    // Get current location and watch for changes
    useEffect(() => {
        let subscription;
        (async () => {
            try {
                // Initial location for fast map rendering
                const loc = await getCurrentLocation();
                setMyLocation(loc);
                const addr = await reverseGeocode(loc.latitude, loc.longitude);
                setPickupName(addr);

                // Continuous watching for high precision
                subscription = await watchLocation(async (newLoc) => {
                    setMyLocation(prev => {
                        // Only update address if moved significantly (> 10m)
                        if (!prev || calculateDistance(prev.latitude, prev.longitude, newLoc.latitude, newLoc.longitude) > 0.01) {
                            reverseGeocode(newLoc.latitude, newLoc.longitude).then(setPickupName);
                        }
                        return newLoc;
                    });
                });
            } catch (err) {
                console.error(err);
                Alert.alert('GPS', 'Necesitamos acceso a tu ubicación exacto para funcionar. Por favor actívalo.');
            }
        })();

        return () => {
            if (subscription) subscription.remove();
        };
    }, []);

    // Listen for online drivers
    useEffect(() => {
        const q = query(collection(db, 'drivers'), where('isOnline', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const driverList = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.location) {
                    driverList.push({ id: doc.id, ...data });
                }
            });
            setDrivers(driverList);
        });
        return unsubscribe;
    }, []);

    // Handle map tap to set destination
    const handleMapMessage = async (message) => {
        if (message.event === 'onMapClicked' && showPanel) {
            const { lat, lng } = message.payload;
            const latitude = lat;
            const longitude = lng;

            setDestination({ latitude, longitude });
            const addr = await reverseGeocode(latitude, longitude);
            setDestinationName(addr);

            if (myLocation) {
                const dist = calculateDistance(
                    myLocation.latitude, myLocation.longitude,
                    latitude, longitude
                );
                const pricing = calculateSuggestedPrice(dist);
                const suggestions = generatePriceSuggestions(pricing.suggestedPrice);
                setPriceSuggestions(suggestions);
                setSelectedPrice(pricing.suggestedPrice);
                setCustomPrice(pricing.suggestedPrice.toString());
            }
        }
    };

    // Toggle request panel
    const togglePanel = () => {
        const toValue = showPanel ? 0 : 1;
        Animated.spring(slideAnim, {
            toValue,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();
        setShowPanel(!showPanel);
    };

    // Send ride request
    const sendRideRequest = async () => {
        if (!destination) {
            Alert.alert('Error', 'Selecciona un destino tocando el mapa');
            return;
        }
        if (!customPrice || Number(customPrice) < 500) {
            Alert.alert('Error', 'El precio mínimo es ₡500');
            return;
        }

        try {
            setRideStatus('searching');
            const rideData = {
                riderId: user.uid,
                riderName: userData?.name || 'Pasajero',
                riderPhone: userData?.phone || '',
                driverId: null,
                status: 'pending',
                pickup: {
                    latitude: myLocation.latitude,
                    longitude: myLocation.longitude,
                    name: pickupName,
                },
                dropoff: {
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                    name: destinationName,
                },
                proposedPrice: Number(customPrice),
                acceptedPrice: null,
                paymentMethod,
                commission: Math.round(Number(customPrice) * 0.01),
                createdAt: serverTimestamp(),
                completedAt: null,
            };

            const rideRef = await addDoc(collection(db, 'rides'), rideData);

            // Listen for ride acceptance
            const unsubscribe = onSnapshot(rideRef, (doc) => {
                const data = doc.data();
                if (data?.status === 'accepted') {
                    setRideStatus('found');
                    unsubscribe();
                    navigation.navigate('RideTracking', {
                        rideId: rideRef.id,
                        driverId: data.driverId,
                    });
                }
            });

            Alert.alert('¡Enviado!', 'Buscando chofer cercano...');
        } catch (error) {
            Alert.alert('Error', 'No se pudo enviar la solicitud');
            setRideStatus(null);
        }
    };

    const panelTranslateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [400, 0],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Map */}
            {myLocation && (
                <View style={styles.map}>
                    <LeafletView
                        ref={mapRef}
                        backgroundColor={COLORS.bgPrimary}
                        onMessageReceived={handleMapMessage}
                        mapLayers={[
                            {
                                baseLayerName: 'CartoDB Dark Matter',
                                baseLayerIsActive: true,
                                url: CARTO_DARK_TILES,
                                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                            }
                        ]}
                        mapCenterPosition={{
                            lat: myLocation.latitude,
                            lng: myLocation.longitude
                        }}
                        zoom={14}
                        mapMarkers={[
                            // User location marker
                            {
                                id: 'user-loc',
                                position: { lat: myLocation.latitude, lng: myLocation.longitude },
                                icon: '📍',
                                size: [32, 32],
                            },
                            // Destination marker
                            ...(destination ? [{
                                id: 'destination',
                                position: { lat: destination.latitude, lng: destination.longitude },
                                icon: '🏁',
                                size: [32, 32],
                            }] : []),
                            // Drivers
                            ...drivers.map(d => ({
                                id: `drv-${d.id}`,
                                position: { lat: d.location.latitude, lng: d.location.longitude },
                                icon: '🚗',
                                size: [32, 32],
                            }))
                        ]}
                    />
                </View>
            )}

            {/* Top bar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
                    <Text style={styles.menuIcon}>☰</Text>
                </TouchableOpacity>

                <View style={styles.earningsBadge}>
                    <Text style={styles.earningsText}>₡0</Text>
                    <Text style={styles.earningsIcon}>▼</Text>
                </View>
            </View>

            {/* Bottom action button */}
            <View style={styles.bottomSection}>
                {!showPanel ? (
                    <TouchableOpacity
                        style={styles.whereToBtn}
                        onPress={togglePanel}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.whereToIcon}>📍</Text>
                        <Text style={styles.whereToText}>¿A dónde vas?</Text>
                        <Text style={styles.whereToArrow}>→</Text>
                    </TouchableOpacity>
                ) : null}

                {/* Recenter Button */}
                {!showPanel && (
                    <TouchableOpacity
                        style={styles.recenterButton}
                        onPress={async () => {
                            try {
                                const loc = await getCurrentLocation();
                                setMyLocation(loc);
                                if (mapRef.current) {
                                    // We call a custom script on the LeafletView to recenter
                                    mapRef.current.injectJavaScript(`
                                    window.map.setView([${loc.latitude}, ${loc.longitude}], 16);
                                `);
                                }
                                const addr = await reverseGeocode(loc.latitude, loc.longitude);
                                setPickupName(addr);
                            } catch (err) {
                                Alert.alert('GPS', 'No se pudo obtener la ubicación exacta');
                            }
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>🎯</Text>
                    </TouchableOpacity>
                )}

                {/* Request Panel */}
                <Animated.View
                    style={[
                        styles.requestPanel,
                        { transform: [{ translateY: panelTranslateY }] },
                    ]}
                >
                    {/* Pickup */}
                    <View style={styles.locationRow}>
                        <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
                        <View style={styles.locationInfo}>
                            <Text style={styles.locationLabel}>Recoger en</Text>
                            <Text style={styles.locationName}>{pickupName || 'Tu ubicación actual'}</Text>
                        </View>
                    </View>

                    {/* Destination */}
                    <View style={styles.locationRow}>
                        <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
                        <View style={styles.locationInfo}>
                            <Text style={styles.locationLabel}>Destino</Text>
                            <Text style={styles.locationName}>
                                {destinationName || 'Toca el mapa para seleccionar'}
                            </Text>
                        </View>
                    </View>

                    {/* Price suggestions */}
                    {priceSuggestions.length > 0 && (
                        <View style={styles.priceSection}>
                            <Text style={styles.priceSectionTitle}>Propone tu precio</Text>
                            <View style={styles.priceSuggestions}>
                                {priceSuggestions.map((item, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.priceChip,
                                            selectedPrice === item.price && styles.priceChipActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedPrice(item.price);
                                            setCustomPrice(item.price.toString());
                                        }}
                                    >
                                        <Text style={[
                                            styles.priceChipLabel,
                                            selectedPrice === item.price && styles.priceChipLabelActive,
                                        ]}>
                                            {item.label}
                                        </Text>
                                        <Text style={[
                                            styles.priceChipPrice,
                                            selectedPrice === item.price && styles.priceChipPriceActive,
                                        ]}>
                                            {formatPrice(item.price)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Custom price input */}
                            <View style={styles.customPriceRow}>
                                <Text style={styles.currencySymbol}>₡</Text>
                                <TextInput
                                    style={styles.customPriceInput}
                                    value={customPrice}
                                    onChangeText={setCustomPrice}
                                    keyboardType="numeric"
                                    placeholder="Precio personalizado"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>
                        </View>
                    )}

                    {/* Payment method */}
                    <View style={styles.paymentRow}>
                        <TouchableOpacity
                            style={[styles.paymentBtn, paymentMethod === 'cash' && styles.paymentBtnActive]}
                            onPress={() => setPaymentMethod('cash')}
                        >
                            <Text style={styles.paymentEmoji}>💵</Text>
                            <Text style={[
                                styles.paymentText,
                                paymentMethod === 'cash' && styles.paymentTextActive
                            ]}>Efectivo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.paymentBtn, paymentMethod === 'sinpe' && styles.paymentBtnActive]}
                            onPress={() => setPaymentMethod('sinpe')}
                        >
                            <Text style={styles.paymentEmoji}>📱</Text>
                            <Text style={[
                                styles.paymentText,
                                paymentMethod === 'sinpe' && styles.paymentTextActive
                            ]}>SINPE</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Send request */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={togglePanel}>
                            <Text style={styles.cancelBtnText}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sendBtn, rideStatus === 'searching' && styles.sendBtnSearching]}
                            onPress={sendRideRequest}
                            disabled={rideStatus === 'searching'}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.sendBtnText}>
                                {rideStatus === 'searching' ? 'Buscando...' : 'Solicitar Viaje'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>

            {/* Side menu modal */}
            <Modal visible={showMenu} transparent animationType="slide">
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={styles.menuContent}>
                        <View style={styles.menuHeader}>
                            <Text style={styles.menuAvatar}>👤</Text>
                            <Text style={styles.menuName}>{userData?.name || 'Usuario'}</Text>
                            <Text style={styles.menuRole}>Pasajero</Text>
                        </View>

                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuItemIcon}>📋</Text>
                            <Text style={styles.menuItemText}>Mis viajes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuItemIcon}>⭐</Text>
                            <Text style={styles.menuItemText}>Calificación: {userData?.rating || 5.0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuItemIcon}>⚙️</Text>
                            <Text style={styles.menuItemText}>Configuración</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                            <Text style={styles.logoutText}>Cerrar sesión</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    driverMarker: {
        backgroundColor: COLORS.bgCard,
        borderRadius: 20,
        padding: 6,
        borderWidth: 2,
        borderColor: COLORS.mapDriver,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    driverMarkerText: {
        fontSize: 20,
    },
    destMarker: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    destMarkerText: {
        fontSize: 28,
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: 10,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    earningsText: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: COLORS.accent,
        marginRight: 4,
    },
    earningsIcon: {
        fontSize: 10,
        color: COLORS.textSecondary,
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.md,
        paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
    },
    whereToBtn: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    whereToIcon: {
        fontSize: 20,
        marginRight: SPACING.sm,
    },
    whereToText: {
        flex: 1,
        fontSize: FONTS.sizes.lg,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    whereToArrow: {
        fontSize: 18,
        color: COLORS.accent,
        fontWeight: '700',
    },
    requestPanel: {
        backgroundColor: COLORS.bgSecondary,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    locationDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.md,
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationName: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textPrimary,
        fontWeight: '500',
        marginTop: 2,
    },
    priceSection: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.md,
    },
    priceSectionTitle: {
        fontSize: FONTS.sizes.sm,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    priceSuggestions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    priceChip: {
        flex: 1,
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    priceChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
    },
    priceChipLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    priceChipLabelActive: {
        color: COLORS.accent,
    },
    priceChipPrice: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textPrimary,
        fontWeight: '700',
        marginTop: 2,
    },
    priceChipPriceActive: {
        color: COLORS.accent,
    },
    customPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
    },
    currencySymbol: {
        fontSize: FONTS.sizes.xl,
        fontWeight: '700',
        color: COLORS.accent,
        marginRight: SPACING.xs,
    },
    customPriceInput: {
        flex: 1,
        fontSize: FONTS.sizes.xl,
        color: COLORS.textPrimary,
        fontWeight: '700',
        paddingVertical: 12,
    },
    paymentRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    paymentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        gap: SPACING.xs,
    },
    paymentBtnActive: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
    },
    paymentEmoji: {
        fontSize: 18,
    },
    paymentText: {
        fontSize: FONTS.sizes.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    paymentTextActive: {
        color: COLORS.accent,
    },
    actionRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    cancelBtn: {
        backgroundColor: COLORS.bgCard,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelBtnText: {
        fontSize: 20,
        color: COLORS.textSecondary,
    },
    sendBtn: {
        flex: 1,
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.xl,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    sendBtnSearching: {
        backgroundColor: COLORS.accentDark,
        opacity: 0.8,
    },
    sendBtnText: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: '#ffffff',
    },
    // Menu modal styles
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContent: {
        width: width * 0.8,
        height: '100%',
        backgroundColor: COLORS.bgSecondary,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: SPACING.lg,
    },
    menuHeader: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    menuAvatar: {
        fontSize: 48,
        marginBottom: SPACING.sm,
    },
    menuName: {
        fontSize: FONTS.sizes.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    menuRole: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.accent,
        fontWeight: '600',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        gap: SPACING.md,
    },
    menuItemIcon: {
        fontSize: 22,
    },
    menuItemText: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    logoutBtn: {
        marginTop: 'auto',
        marginBottom: SPACING.xxl,
        backgroundColor: COLORS.errorBg,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(248, 81, 73, 0.3)',
    },
    logoutText: {
        color: COLORS.error,
        fontWeight: '600',
        fontSize: FONTS.sizes.md,
    },
    recenterButton: {
        position: 'absolute',
        bottom: 120,
        right: SPACING.lg,
        backgroundColor: COLORS.bgSecondary,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        borderWidth: 1,
        borderColor: COLORS.accent + '44',
    },
});
