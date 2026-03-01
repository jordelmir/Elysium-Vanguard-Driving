import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions,
    StatusBar, TextInput, Modal, Alert, Animated, Platform, ScrollView
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import { useAuth, calculateRatingPercentage } from '../../context/AuthContext';
import {
    getCurrentLocation, watchLocation, calculateDistance,
    searchPlaces, getPlaceDetails, reverseGeocode, getRoute
} from '../../lib/geo';
import { calculateSuggestedPrice, generatePriceSuggestions, formatPrice } from '../../lib/pricing';
import { db } from '../../lib/firebase';
import {
    collection, query, where, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { scale, moderateScale, SCREEN_WIDTH, SCREEN_HEIGHT, DEVICE_SIZE } from '../../theme/responsive';

const { width, height } = Dimensions.get('window');

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
    const [mapZoom, setMapZoom] = useState(14);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (rideStatus === 'searching') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(progressAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(progressAnim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        } else {
            progressAnim.setValue(0);
        }
    }, [rideStatus]);

    useEffect(() => {
        let subscription;
        (async () => {
            try {
                const loc = await getCurrentLocation();
                setMyLocation(loc);
                const addr = await reverseGeocode(loc.latitude, loc.longitude);
                setPickupName(addr);

                subscription = await watchLocation(async (newLoc) => {
                    setMyLocation(prev => {
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

    const handleMapMessage = async (message) => {
        if (message.event === 'onMapClicked') {
            if (showPanel && !isMapPickerMode) {
                const { lat, lng } = message.payload;
                updateDestination(lat, lng);
            }
        } else if (message.event === 'onMoveEnd' && isMapPickerMode) {
            const { lat, lng } = message.payload;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                // Debounced/Buffered update for smooth tuning
                updateDestination(lat, lng, true);
            }
        }
    };

    const updateDestination = async (lat, lng, isSilent = false) => {
        const latitude = lat;
        const longitude = lng;

        setDestination({ latitude, longitude });

        if (myLocation) {
            const route = await getRoute(myLocation.latitude, myLocation.longitude, latitude, longitude);
            if (route) {
                setRouteInfo({
                    distance: parseFloat(route.distance.toFixed(2)),
                    duration: Math.ceil(route.duration)
                });
                setRouteCoordinates(route.coordinates);

                if (mapRef.current && route.coordinates.length > 0) {
                    const bounds = route.coordinates.map(c => [c.lat, c.lng]);
                    mapRef.current.injectJavaScript(`
                        if (window.map) {
                            window.map.fitBounds(${JSON.stringify(bounds)}, { padding: [50, 50] });
                        }
                    `);
                }

                const pricing = calculateSuggestedPrice(route.distance);
                const suggestions = generatePriceSuggestions(pricing.suggestedPrice);
                setPriceSuggestions(suggestions);
                setSelectedPrice(pricing.suggestedPrice);
                setCustomPrice(pricing.suggestedPrice.toString());
            } else {
                // Fallback to straight line if OSRM fails
                const dist = calculateDistance(myLocation.latitude, myLocation.longitude, latitude, longitude);
                const pricing = calculateSuggestedPrice(dist || 0);
                setRouteInfo({
                    distance: pricing.distanceKm || 0,
                    duration: pricing.estimatedMinutes || 2
                });
                setRouteCoordinates([]);
            }
        }

        if (!isSilent) {
            const details = await getPlaceDetails(latitude, longitude);
            setDestinationName(details.address);
        }
    };

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                setIsSearching(true);
                const results = await searchPlaces(
                    searchQuery,
                    myLocation?.latitude,
                    myLocation?.longitude
                );
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

        if (mapRef.current) {
            mapRef.current.injectJavaScript(`
                window.map.flyTo([${item.latitude}, ${item.longitude}], 16);
            `);
        }

        if (myLocation) {
            const fetchRoute = async () => {
                const route = await getRoute(myLocation.latitude, myLocation.longitude, item.latitude, item.longitude);
                if (route) {
                    setRouteInfo({
                        distance: parseFloat(route.distance.toFixed(2)),
                        duration: Math.ceil(route.duration)
                    });
                    setRouteCoordinates(route.coordinates);

                    if (mapRef.current && route.coordinates.length > 0) {
                        const bounds = route.coordinates.map(c => [c.lat, c.lng]);
                        mapRef.current.injectJavaScript(`
                            if (window.map) {
                                window.map.fitBounds(${JSON.stringify(bounds)}, { padding: [50, 50] });
                            }
                        `);
                    }

                    const pricing = calculateSuggestedPrice(route.distance);
                    const suggestions = generatePriceSuggestions(pricing.suggestedPrice);
                    setPriceSuggestions(suggestions);
                    setSelectedPrice(pricing.suggestedPrice);
                    setCustomPrice(pricing.suggestedPrice.toString());
                } else {
                    const dist = calculateDistance(
                        myLocation.latitude, myLocation.longitude,
                        item.latitude, item.longitude
                    );
                    const pricing = calculateSuggestedPrice(dist || 0);
                    setRouteInfo({
                        distance: pricing.distanceKm || 0,
                        duration: pricing.estimatedMinutes || 2
                    });
                    setRouteCoordinates([]);
                }
            };
            fetchRoute();
        }

        if (!showPanel) togglePanel();
    };

    const togglePanel = () => {
        const toValue = showPanel ? 0 : 1;
        Animated.spring(slideAnim, {
            toValue,
            useNativeDriver: true,
            damping: 15,
            stiffness: 90,
        }).start();
        setShowPanel(!showPanel);
    };

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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >

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
                                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                                }
                            ]}
                            mapCenterPosition={{
                                lat: myLocation.latitude,
                                lng: myLocation.longitude
                            }}
                            zoom={mapZoom}
                            mapMarkers={[
                                {
                                    id: 'user-loc',
                                    position: { lat: myLocation.latitude, lng: myLocation.longitude },
                                    icon: '📍',
                                    size: [32, 32],
                                },
                                ...(destination ? [{
                                    id: 'destination',
                                    position: { lat: destination.latitude, lng: destination.longitude },
                                    icon: '🏁',
                                    size: [32, 32],
                                }] : []),
                                size: [32, 32],
                            }))
                        ]}
                        mapShapes={routeCoordinates.length > 0 ? [{
                            shapeType: 'Polyline',
                            color: COLORS.accent,
                            id: 'route-line',
                            positions: routeCoordinates,
                            weight: 5,
                            opacity: 0.8
                        }] : []}
                    />

                        {/* Top-Tier Map Overlay: Zoom & Recenter Controls */}
                        <View style={styles.mapControls}>
                            <TouchableOpacity
                                style={styles.mapControlButton}
                                onPress={() => {
                                    const nextZoom = Math.min(mapZoom + 1, 19);
                                    setMapZoom(nextZoom);
                                    mapRef.current?.injectJavaScript(`window.map.setZoom(${nextZoom})`);
                                }}
                            >
                                <Text style={styles.mapControlText}>+</Text>
                            </TouchableOpacity>
                            <View style={styles.controlDivider} />
                            <TouchableOpacity
                                style={styles.mapControlButton}
                                onPress={() => {
                                    const nextZoom = Math.max(mapZoom - 1, 5);
                                    setMapZoom(nextZoom);
                                    mapRef.current?.injectJavaScript(`window.map.setZoom(${nextZoom})`);
                                }}
                            >
                                <Text style={styles.mapControlText}>−</Text>
                            </TouchableOpacity>
                            <View style={styles.controlDivider} />
                            <TouchableOpacity
                                style={styles.mapControlButton}
                                onPress={async () => {
                                    try {
                                        const loc = await getCurrentLocation();
                                        setMyLocation(loc);
                                        if (mapRef.current) {
                                            mapRef.current.injectJavaScript(`window.map.flyTo([${loc.latitude}, ${loc.longitude}], 16);`);
                                        }
                                    } catch (error) {
                                        Alert.alert('Error', 'No se pudo obtener la ubicación');
                                    }
                                }}
                            >
                                <Text style={{ fontSize: 20 }}>🎯</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!isMapPickerMode && (
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="📍 ¿A dónde vamos en CR?"
                                placeholderTextColor={COLORS.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onFocus={() => {
                                    if (!showPanel) togglePanel();
                                }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Text style={styles.clearIcon}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {searchResults.length > 0 && (
                            <Animated.View style={[styles.resultsContainer, { opacity: slideAnim }]}>
                                <View style={{ marginBottom: SPACING.md, alignItems: 'center' }}>
                                    <Text style={styles.summaryTitle}>Resumen del Viaje</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 8 }}>
                                        <Text style={styles.metricValue}>📏 {routeInfo.distance} km</Text>
                                        <Text style={styles.metricValue}>⏱️ {routeInfo.duration} min</Text>
                                    </View>
                                    <Text style={styles.addressText} numberOfLines={1}>📍 {pickupName}</Text>
                                    <Text style={styles.addressText} numberOfLines={1}>🏁 {destinationName}</Text>
                                </View>
                                <ScrollView
                                    style={{ maxHeight: 250 }}
                                    showsVerticalScrollIndicator={true}
                                    keyboardShouldPersistTaps="handled"
                                >
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
                                </ScrollView>
                            </Animated.View>
                        )}
                    </View>
                )}

                {!isMapPickerMode && (
                    <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)}>
                        <Text style={styles.menuIcon}>☰</Text>
                    </TouchableOpacity>
                )}

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

                        <View style={styles.pickerMetricsBox}>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricEmoji}>📏</Text>
                                <Text style={styles.metricValue}>
                                    {routeInfo.distance || '0.0'} km
                                </Text>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricItem}>
                                <Text style={styles.metricEmoji}>⏱️</Text>
                                <Text style={styles.metricValue}>
                                    {routeInfo.duration || '2'} min
                                </Text>
                            </View>
                        </View>

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
                    </>
                )}

                <View style={styles.bottomSection}>
                    {!showPanel && !isMapPickerMode && (
                        <TouchableOpacity
                            style={[styles.recenterButton, { bottom: 20 }]}
                            onPress={async () => {
                                try {
                                    const loc = await getCurrentLocation();
                                    setMyLocation(loc);
                                    if (mapRef.current) {
                                        mapRef.current.injectJavaScript(`
                                        window.map.flyTo([${loc.latitude}, ${loc.longitude}], 16, { animate: true, duration: 1.5 });
                                    `);
                                    }
                                    const addr = await reverseGeocode(loc.latitude, loc.longitude);
                                    setPickupName(addr);
                                } catch (err) {
                                    Alert.alert('GPS', 'No se pudo obtener la ubicación exacta');
                                }
                            }}
                        >
                            <Text style={{ fontSize: 24 }}>🎯</Text>
                        </TouchableOpacity>
                    )}


                    {!isMapPickerMode && (
                        <Animated.View
                            style={[
                                styles.requestPanel,
                                { transform: [{ translateY: panelTranslateY }] },
                            ]}
                        >
                            <View style={styles.locationRow}>
                                <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
                                <View style={styles.locationInfo}>
                                    <Text style={styles.locationLabel}>Recoger en</Text>
                                    <Text style={styles.locationName}>{pickupName || 'Tu ubicación actual'}</Text>
                                </View>
                            </View>

                            <View style={styles.locationRow}>
                                <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
                                <View style={styles.locationInfo}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={styles.locationLabel}>Destino</Text>
                                        <TouchableOpacity onPress={() => {
                                            if (!destination && myLocation) {
                                                setDestination({ latitude: myLocation.latitude, longitude: myLocation.longitude });
                                            }
                                            setIsMapPickerMode(true);
                                        }}>
                                            <Text style={styles.mapPickText}>Seleccionar en mapa</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.locationName} numberOfLines={2}>
                                        {destinationName || 'Selecciona un destino'}
                                    </Text>
                                </View>
                            </View>

                            {priceSuggestions.length > 0 && (
                                <View style={styles.priceSection}>
                                    <Text style={styles.priceSectionTitle}>Propone tu precio</Text>
                                    <View style={styles.priceGrid}>
                                        {priceSuggestions.map((item, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.priceSuggestion,
                                                    selectedPrice === item.price && styles.priceChipActive,
                                                ]}
                                                onPress={() => {
                                                    setSelectedPrice(item.price);
                                                    setCustomPrice(item.price.toString());
                                                }}
                                            >
                                                <Text style={[
                                                    styles.priceText,
                                                    selectedPrice === item.price && { color: COLORS.accent },
                                                ]}>
                                                    {item.label} ({formatPrice(item.price)})
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

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

                            <View style={styles.paymentRow}>
                                <TouchableOpacity
                                    style={[styles.paymentBtn, paymentMethod === 'cash' && styles.paymentBtnActive]}
                                    onPress={() => setPaymentMethod('cash')}
                                >
                                    <Text style={styles.paymentEmoji}>💵</Text>
                                    <Text style={[styles.paymentText, paymentMethod === 'cash' && styles.paymentTextActive]}>Efectivo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.paymentBtn, paymentMethod === 'sinpe' && styles.paymentBtnActive]}
                                    onPress={() => setPaymentMethod('sinpe')}
                                >
                                    <Text style={styles.paymentEmoji}>📱</Text>
                                    <Text style={[styles.paymentText, paymentMethod === 'sinpe' && styles.paymentTextActive]}>SINPE</Text>
                                </TouchableOpacity>
                            </View>

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
                    )}
                </View>

                <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                    <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
                        <View style={styles.menuContent}>
                            <View style={styles.menuHeader}>
                                <View style={styles.userAvatarLarge}>
                                    <Text style={{ fontSize: 40 }}>👤</Text>
                                </View>
                                <Text style={styles.menuUserName}>{userData?.name || 'Usuario'}</Text>
                                <View style={styles.ratingBadgeContainer}>
                                    <Text style={styles.ratingPercent}>
                                        ⭐ {calculateRatingPercentage(userData?.rating || 5.0)}
                                    </Text>
                                    <View style={styles.recommendedBadge}>
                                        <Text style={styles.recommendedText}>¡Pasajero Recomendado!</Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    setShowMenu(false);
                                    navigation.navigate('RiderHistory');
                                }}
                            >
                                <Text style={styles.menuItemIcon}>📋</Text>
                                <Text style={styles.menuItemText}>Mis viajes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={logout}>
                                <Text style={styles.menuItemIcon}>🚪</Text>
                                <Text style={styles.menuItemText}>Cerrar sesión</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {rideStatus === 'searching' && (
                    <Animated.View style={[styles.searchingOverlay, { opacity: slideAnim }]}>
                        <View style={styles.searchingCard}>
                            <Animated.View style={[styles.searchingPulse, {
                                transform: [{
                                    scale: slideAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.8, 1.2]
                                    })
                                }]
                            }]}>
                                <Text style={styles.searchingEmoji}>🚗</Text>
                            </Animated.View>
                            <Text style={styles.searchingTitle}>Buscando Conductores</Text>
                            <Text style={styles.searchingSub}>Estamos conectándote con la flota de Elysium Vanguard en Costa Rica...</Text>

                            <View style={styles.searchingProgressContainer}>
                                <Animated.View style={[styles.searchingProgressBar, {
                                    transform: [{
                                        translateX: progressAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-width * 0.4, width * 0.85]
                                        })
                                    }]
                                }]} />
                            </View>

                            <TouchableOpacity
                                style={styles.cancelRequestBtn}
                                onPress={() => {
                                    setRideStatus(null);
                                    // Reset animations if needed
                                }}
                            >
                                <Text style={styles.cancelRequestText}>Cancelar Solicitud</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
            </KeyboardAvoidingView>
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
    clearIcon: {
        padding: 5,
        color: COLORS.textMuted,
        fontSize: 16,
    },
    resultsContainer: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        marginTop: 8,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    summaryTitle: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
    },
    metricValue: {
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    addressText: {
        fontSize: moderateScale(12),
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
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
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.md,
        paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
        backgroundColor: 'transparent',
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
        elevation: 8,
    },
    whereToIcon: {
        fontSize: 20,
        marginRight: SPACING.sm,
    },
    whereToText: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    whereToArrow: {
        fontSize: 18,
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    requestPanel: {
        backgroundColor: COLORS.bgSecondary,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    locationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 15,
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
    },
    locationName: {
        fontSize: 15,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    mapPickText: {
        fontSize: 12,
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    priceSection: {
        marginVertical: SPACING.sm,
    },
    priceSectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    priceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    priceSuggestion: {
        backgroundColor: COLORS.bgCard,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: DEVICE_SIZE.LARGE ? '30%' : (DEVICE_SIZE.MEDIUM ? '45%' : '100%'),
        alignItems: 'center',
    },
    priceText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    priceChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '11',
    },
    customPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        marginTop: 10,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    currencySymbol: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    customPriceInput: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        paddingVertical: 10,
        marginLeft: 5,
    },
    paymentRow: {
        flexDirection: 'row',
        gap: 10,
        marginVertical: 15,
    },
    paymentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bgCard,
        paddingVertical: 12,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
    },
    paymentBtnActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '11',
    },
    paymentEmoji: { fontSize: 18 },
    paymentText: { color: COLORS.textSecondary, fontWeight: '600' },
    paymentTextActive: { color: COLORS.accent },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelBtnText: { fontSize: 20, color: COLORS.textSecondary },
    sendBtn: {
        flex: 1,
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
    },
    sendBtnSearching: {
        backgroundColor: COLORS.textMuted,
    },
    sendBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContent: {
        width: width * 0.75,
        height: '100%',
        backgroundColor: COLORS.bgSecondary,
    },
    menuHeader: {
        padding: 30,
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
        marginBottom: 15,
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    menuUserName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 5,
    },
    ratingBadgeContainer: {
        alignItems: 'center',
    },
    ratingPercent: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    recommendedBadge: {
        backgroundColor: COLORS.success + '22',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 5,
        marginTop: 5,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    recommendedText: {
        color: COLORS.success,
        fontSize: 12,
        fontWeight: 'bold',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border + '11',
    },
    menuItemIcon: { fontSize: 20, marginRight: 15 },
    menuItemText: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
    searchingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
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
    searchingEmoji: { fontSize: 40 },
    searchingTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 10 },
    searchingSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 30 },
    searchingProgressContainer: {
        width: '100%',
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginVertical: 20,
    },
    searchingProgressBar: {
        width: '40%',
        height: '100%',
        backgroundColor: COLORS.accent,
        borderRadius: 2,
    },
    cancelRequestBtn: {
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelRequestText: { color: COLORS.error, fontWeight: 'bold' },
    mapPickerContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    crosshairVertical: { width: 1, height: 40, backgroundColor: COLORS.accent, position: 'absolute' },
    crosshairHorizontal: { width: 40, height: 1, backgroundColor: COLORS.accent, position: 'absolute' },
    fixedPin: { marginBottom: 40 },
    fixedPinIcon: { fontSize: 40 },
    pinPulse: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.accent + '44',
        position: 'absolute',
        bottom: -10,
        left: 10,
    },
    pickerMetricsBox: {
        position: 'absolute',
        top: 100,
        flexDirection: 'row',
        backgroundColor: COLORS.bgCard,
        padding: 15,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.accent,
        alignItems: 'center',
    },
    metricItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metricEmoji: { fontSize: 14 },
    metricDivider: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 15 },
    confirmMapPickerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    // Professional Map Controls
    mapControls: {
        position: 'absolute',
        right: 15,
        top: '30%',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: 5,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
            },
            android: { elevation: 10 },
        }),
    },
    mapControlButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapControlText: {
        fontSize: 24,
        color: COLORS.textPrimary,
        fontWeight: '300',
    },
    controlDivider: {
        height: 1,
        width: '70%',
        alignSelf: 'center',
        backgroundColor: COLORS.border,
    },
});
