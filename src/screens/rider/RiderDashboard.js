import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions,
    StatusBar, TextInput, Modal, Alert, Animated, Platform,
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { useAuth, calculateRatingPercentage } from '../../context/AuthContext';
import {
    getCurrentLocation, watchLocation, calculateDistance,
    searchPlaces, getPlaceDetails, reverseGeocode
} from '../../lib/geo';
import { calculateSuggestedPrice, generatePriceSuggestions, formatPrice } from '../../lib/pricing';
import { db } from '../../lib/firebase';
import {
    collection, query, where, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { scale, moderateScale, SCREEN_WIDTH, SCREEN_HEIGHT, DEVICE_SIZE } from '../../theme/responsive';

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
    const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0 });
    const [destinationName, setDestinationName] = useState('');
    const [pickupName, setPickupName] = useState('');
    const [selectedPrice, setSelectedPrice] = useState(0);
    const [customPrice, setCustomPrice] = useState('');
    const [priceSuggestions, setPriceSuggestions] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [showMenu, setShowMenu] = useState(false);
    const [rideStatus, setRideStatus] = useState(null); // null, 'searching', 'found'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isMapPickerMode, setIsMapPickerMode] = useState(false);
    const [mapRegion, setMapRegion] = useState(null);

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

    // Handle map movement for Map Picker
    const handleMapMessage = async (message) => {
        if (message.event === 'onMapClicked') {
            if (showPanel && !isMapPickerMode) {
                const { lat, lng } = message.payload;
                updateDestination(lat, lng);
            }
        } else if (message.event === 'onMoveEnd' && isMapPickerMode) {
            const { lat, lng } = message.payload;
            updateDestination(lat, lng, true);
        }
    };

    const updateDestination = async (lat, lng, isSilent = false) => {
        const latitude = lat;
        const longitude = lng;

        setDestination({ latitude, longitude });

        let dist = 0;
        if (myLocation) {
            dist = calculateDistance(
                myLocation.latitude, myLocation.longitude,
                latitude, longitude
            );
            const pricing = calculateSuggestedPrice(dist);
            setRouteInfo({
                distance: pricing.distanceKm,
                duration: pricing.estimatedMinutes
            });

            const suggestions = generatePriceSuggestions(pricing.suggestedPrice);
            setPriceSuggestions(suggestions);
            setSelectedPrice(pricing.suggestedPrice);
            setCustomPrice(pricing.suggestedPrice.toString());
        }

        if (!isSilent) {
            const details = await getPlaceDetails(latitude, longitude);
            setDestinationName(details.address);
        }
    };

    // Search logic
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                setIsSearching(true);
                const results = await searchPlaces(searchQuery);
                setSearchResults(results);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const selectSearchResult = (item) => {
        setDestination({ latitude: item.latitude, longitude: item.longitude });
        setDestinationName(item.name);
        setSearchQuery('');
        setSearchResults([]);

        // Animate map to destination
        if (mapRef.current) {
            mapRef.current.injectJavaScript(`
                window.map.flyTo([${item.latitude}, ${item.longitude}], 16);
            `);
        }

        // Update pricing
        if (myLocation) {
            const dist = calculateDistance(
                myLocation.latitude, myLocation.longitude,
                item.latitude, item.longitude
            );
            const pricing = calculateSuggestedPrice(dist);
            setRouteInfo({
                distance: pricing.distanceKm,
                duration: pricing.estimatedMinutes
            });
            const suggestions = generatePriceSuggestions(pricing.suggestedPrice);
            setPriceSuggestions(suggestions);
            setSelectedPrice(pricing.suggestedPrice);
            setCustomPrice(pricing.suggestedPrice.toString());
        }

        if (!showPanel) togglePanel();
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
                distance: routeInfo.distance,
                duration: routeInfo.duration,
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

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="¿A dónde vamos?"
                        placeholderTextColor={COLORS.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={styles.clearIcon}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {searchResults.length > 0 && (
                    <View style={styles.resultsContainer}>
                        {/* Summary Info */}
                        <View style={{ marginBottom: SPACING.md, alignItems: 'center' }}>
                            <Text style={styles.summaryTitle}>Resumen del Viaje</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 8 }}>
                                <Text style={styles.metricValue}>📏 {routeInfo.distance} km</Text>
                                <Text style={styles.metricValue}>⏱️ {routeInfo.duration} min</Text>
                            </View>
                            <Text style={styles.addressText} numberOfLines={1}>📍 {pickupName}</Text>
                            <Text style={styles.addressText} numberOfLines={1}>🏁 {destinationName}</Text>
                        </View>
                        {searchResults.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.resultItem}
                                onPress={() => selectSearchResult(item)}
                            >
                                <Text style={styles.resultPin}>📍</Text>
                                <View style={styles.resultInfo}>
                                    <Text style={styles.resultName} numberOfLines={1}>{item.shortName}</Text>
                                    <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
                <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>

            {/* Map Picker UI Updates */}
            {isMapPickerMode && (
                <>
                    <View style={styles.mapPickerContainer} pointerEvents="none">
                        <View style={styles.crosshairVertical} />
                        <View style={styles.crosshairHorizontal} />
                        <View style={styles.fixedPin}>
                            <Text style={styles.fixedPinIcon}>📍</Text>
                            <View style={styles.pinPulse} />
                        </View>
                    </View>

                    {/* Real-time Metrics Info Box */}
                    <View style={styles.pickerMetricsBox}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricEmoji}>📏</Text>
                            <Text style={styles.metricValue}>
                                {routeInfo.distance ? `${routeInfo.distance} km` : '...'}
                            </Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                            <Text style={styles.metricEmoji}>⏱️</Text>
                            <Text style={styles.metricValue}>
                                {routeInfo.duration ? `${routeInfo.duration} min` : '...'}
                            </Text>
                        </View>
                    </View>
                </>
            )}

            {isMapPickerMode && (
                <TouchableOpacity
                    style={styles.confirmMapPicker}
                    onPress={async () => {
                        setIsMapPickerMode(false);
                        const details = await getPlaceDetails(destination.latitude, destination.longitude);
                        setDestinationName(details.address);
                        if (!showPanel) togglePanel();
                    }}
                >
                    <Text style={styles.confirmMapPickerText}>Confirmar Destino</Text>
                </TouchableOpacity>
            )}

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
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.locationLabel}>Destino</Text>
                                <TouchableOpacity onPress={() => setIsMapPickerMode(true)}>
                                    <Text style={styles.mapPickText}>Seleccionar en mapa</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.locationName} numberOfLines={2}>
                                {destinationName || 'Selecciona un destino'}
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
                            activeOpacity={0.8}
                            onPress={sendRideRequest}
                            disabled={rideStatus === 'searching'}
                        >
                            <Text style={styles.sendBtnText}>
                                {rideStatus === 'searching' ? 'Buscando...' : 'Pedir Viaje Now'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>

            {/* Side Menu */}
            <Modal
                visible={showMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
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

            {/* Searching Overlay */}
            {rideStatus === 'searching' && (
                <View style={styles.searchingOverlay}>
                    <View style={styles.searchingCard}>
                        <View style={styles.searchingPulse}>
                            <Text style={styles.searchingEmoji}>🚗</Text>
                        </View>
                        <Text style={styles.searchingTitle}>Buscando Conductores</Text>
                        <Text style={styles.searchingSub}>Estamos conectándote con la flota de Elysium Vanguard...</Text>

                        <TouchableOpacity
                            style={styles.cancelRequestBtn}
                            onPress={() => setRideStatus(null)}
                        >
                            <Text style={styles.cancelRequestText}>Cancelar Solicitud</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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
        menuButton: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 55 : 35,
            left: SPACING.md,
            zIndex: 110,
            backgroundColor: COLORS.bgCard,
            width: scale(45),
            height: scale(45),
            borderRadius: scale(22.5),
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
        menuIcon: {
            fontSize: moderateScale(20),
            color: COLORS.accent,
        },
        recenterButton: {
            position: 'absolute',
            bottom: 100,
            right: SPACING.md,
            backgroundColor: COLORS.bgCard,
            width: scale(50),
            height: scale(50),
            borderRadius: scale(25),
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
        searchContainer: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 55 : 35,
            left: scale(70),
            right: SPACING.md,
            zIndex: 100,
        },
        searchInputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.bgCard,
            borderRadius: RADIUS.lg,
            paddingHorizontal: SPACING.md,
            paddingVertical: scale(10),
            borderWidth: 1,
            borderColor: COLORS.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 6,
        },
        searchInput: {
            flex: 1,
            fontSize: moderateScale(15),
            color: COLORS.textPrimary,
            fontWeight: '500',
            textAlign: DEVICE_SIZE.SMALL ? 'center' : 'left',
        },
        priceGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: scale(8),
            marginBottom: SPACING.md,
        },
        priceSuggestion: {
            backgroundColor: COLORS.bgCard,
            paddingVertical: scale(10),
            paddingHorizontal: scale(12),
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: COLORS.border,
            minWidth: DEVICE_SIZE.LARGE ? '30%' : (DEVICE_SIZE.MEDIUM ? '45%' : '100%'),
            alignItems: 'center',
        },
        priceText: {
            color: COLORS.textPrimary,
            fontSize: moderateScale(14),
            fontWeight: 'bold',
            textAlign: 'center',
        },
        sendBtn: {
            backgroundColor: COLORS.accent,
            borderRadius: RADIUS.lg,
            paddingVertical: scale(15),
            alignItems: 'center',
            shadowColor: COLORS.accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        sendBtnText: {
            color: '#fff',
            fontSize: moderateScale(16),
            fontWeight: 'bold',
            letterSpacing: 0.5,
            textAlign: 'center',
        },
        searchingCard: {
            backgroundColor: COLORS.bgSecondary,
            width: DEVICE_SIZE.LARGE ? scale(400) : SCREEN_WIDTH * 0.85,
            borderRadius: RADIUS.xl,
            padding: scale(30),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.accent + '44',
        },
        searchingTitle: {
            fontSize: moderateScale(22),
            fontWeight: 'bold',
            color: COLORS.textPrimary,
            marginBottom: 10,
            textAlign: 'center',
        },
        searchingSub: {
            fontSize: moderateScale(14),
            color: COLORS.textMuted,
            textAlign: 'center',
            marginBottom: scale(30),
            lineHeight: moderateScale(20),
        },
        summaryTitle: {
            fontSize: moderateScale(18),
            fontWeight: 'bold',
            color: COLORS.textPrimary,
            textAlign: 'center',
            marginBottom: SPACING.md,
        },
        addressText: {
            fontSize: moderateScale(14),
            color: COLORS.textSecondary,
            textAlign: 'center',
            marginVertical: 4,
        },
        searchInput: {
            flex: 1,
            fontSize: 16,
            color: COLORS.textPrimary,
            fontWeight: '500',
        },
        clearIcon: {
            fontSize: 18,
            color: COLORS.textMuted,
            padding: 5,
        },
        resultsContainer: {
            backgroundColor: COLORS.bgCard,
            borderRadius: RADIUS.lg,
            marginTop: 8,
            padding: 5,
            borderWidth: 1,
            borderColor: COLORS.border,
            maxHeight: 250,
            overflow: 'hidden',
        },
        resultItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border + '22',
        },
        resultPin: {
            fontSize: 18,
            marginRight: 12,
        },
        resultInfo: {
            flex: 1,
        },
        resultName: {
            fontSize: 14,
            fontWeight: 'bold',
            color: COLORS.textPrimary,
        },
        resultAddress: {
            fontSize: 12,
            color: COLORS.textMuted,
            marginTop: 2,
        },
        mapPickerContainer: {
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 50,
        },
        crosshairVertical: {
            position: 'absolute',
            width: 1,
            height: 60,
            backgroundColor: COLORS.accent,
            opacity: 0.5,
        },
        crosshairHorizontal: {
            position: 'absolute',
            width: 60,
            height: 1,
            backgroundColor: COLORS.accent,
            opacity: 0.5,
        },
        fixedPin: {
            marginTop: -32, // Offset for pin point
        },
        fixedPinIcon: {
            fontSize: 40,
            textShadowColor: 'rgba(0, 0, 0, 0.4)',
            textShadowOffset: { width: 0, height: 4 },
            textShadowRadius: 6,
            zIndex: 2,
        },
        pinPulse: {
            position: 'absolute',
            width: 20,
            height: 10,
            backgroundColor: 'rgba(255, 107, 53, 0.4)',
            borderRadius: 10,
            bottom: -5,
            transform: [{ scaleX: 2 }],
        },
        pickerMetricsBox: {
            position: 'absolute',
            top: 150,
            flexDirection: 'row',
            backgroundColor: COLORS.bgCard,
            borderRadius: RADIUS.lg,
            paddingHorizontal: 16,
            paddingVertical: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.accent,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
            zIndex: 200,
        },
        metricItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        metricEmoji: {
            fontSize: 14,
        },
        metricValue: {
            fontSize: 14,
            fontWeight: 'bold',
            color: COLORS.textPrimary,
        },
        metricDivider: {
            width: 1,
            height: 15,
            backgroundColor: COLORS.border,
            marginHorizontal: 12,
        },
        searchingOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        },
        searchingCard: {
            backgroundColor: COLORS.bgSecondary,
            width: width * 0.85,
            borderRadius: RADIUS.xl,
            padding: 30,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.accent + '44',
        },
        searchingPulse: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: COLORS.accent + '22',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
        },
        searchingEmoji: {
            fontSize: 40,
        },
        searchingTitle: {
            fontSize: 22,
            fontWeight: 'bold',
            color: COLORS.textPrimary,
            marginBottom: 10,
            textAlign: 'center',
        },
        searchingSub: {
            fontSize: 14,
            color: COLORS.textMuted,
            textAlign: 'center',
            marginBottom: 30,
            lineHeight: 20,
        },
        cancelRequestBtn: {
            paddingVertical: 12,
            paddingHorizontal: 25,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        cancelRequestText: {
            color: COLORS.error,
            fontWeight: 'bold',
            fontSize: 14,
        },
        confirmMapPicker: {
            position: 'absolute',
            bottom: 40,
            left: SPACING.xl,
            right: SPACING.xl,
            backgroundColor: COLORS.accent,
            paddingVertical: 16,
            borderRadius: RADIUS.xl,
            alignItems: 'center',
            shadowColor: COLORS.accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 8,
            zIndex: 200,
        },
        confirmMapPickerText: {
            color: '#fff',
            fontSize: 18,
            fontWeight: 'bold',
        },
        mapPickText: {
            fontSize: 12,
            color: COLORS.accent,
            fontWeight: 'bold',
        },
    });
