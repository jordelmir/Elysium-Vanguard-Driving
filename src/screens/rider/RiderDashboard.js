import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions,
    StatusBar, TextInput, Modal, Alert, Animated, Platform, ScrollView,
    KeyboardAvoidingView
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
    doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { scale, moderateScale, SCREEN_WIDTH, SCREEN_HEIGHT, DEVICE_SIZE, SAFE_TOP, SAFE_BOTTOM } from '../../theme/responsive';

const { width, height } = Dimensions.get('window');

export const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export default function RiderDashboard({ navigation }) {
    const { user, userData, logout } = useAuth();
    const mapRef = useRef(null);
    const slideAnim = useRef(new Animated.Value(0)).current;

    const [myLocation, setMyLocation] = useState(null); // Real GPS
    const [pickupLocation, setPickupLocation] = useState(null); // Actual ride start
    const [isManualPickup, setIsManualPickup] = useState(false);
    const [drivers, setDrivers] = useState([]);
    const [showPanel, setShowPanel] = useState(false);
    const [destination, setDestination] = useState(null);
    const [destinationName, setDestinationName] = useState('');
    const [stops, setStops] = useState([]); // Array of { latitude, longitude, name }
    const [activeSearchIndex, setActiveSearchIndex] = useState(-1); // -1 = destination, 0,1,2... = stop
    const [pickupName, setPickupName] = useState('');
    const [selectedPrice, setSelectedPrice] = useState(0);
    const [customPrice, setCustomPrice] = useState('');
    const [minPrice, setMinPrice] = useState(0);
    const [priceSuggestions, setPriceSuggestions] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [showMenu, setShowMenu] = useState(false);
    const [rideStatus, setRideStatus] = useState(null); // null, 'searching', 'found'
    const [currentRideId, setCurrentRideId] = useState(null);
    const [rideUnsubscribe, setRideUnsubscribe] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isMapPickerMode, setIsMapPickerMode] = useState(false);
    const [mapZoom, setMapZoom] = useState(14);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0 });
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
                    setMyLocation(newLoc);
                    if (!isManualPickup) {
                        setPickupLocation(newLoc);
                        reverseGeocode(newLoc.latitude, newLoc.longitude).then(setPickupName);
                    }
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

    const updateDestination = async (lat, lng, isSilent = false) => {
        const latitude = lat;
        const longitude = lng;

        // activeSearchIndex: -2 = pickup, -1 = destination, 0+ = stop
        if (activeSearchIndex === -2) {
            setPickupLocation({ latitude, longitude });
            setIsManualPickup(true);
        } else if (activeSearchIndex === -1) {
            setDestination({ latitude, longitude });
        } else {
            const newStops = [...stops];
            newStops[activeSearchIndex] = { ...newStops[activeSearchIndex], latitude, longitude, name: '' };
            setStops(newStops);
        }

        const validStops = stops.filter((s, idx) =>
            (idx === activeSearchIndex) ? (latitude && longitude) : (s.latitude && s.longitude)
        );

        const points = [
            { latitude: pickupLocation?.latitude || myLocation?.latitude, longitude: pickupLocation?.longitude || myLocation?.longitude },
            ...validStops,
        ];

        if (activeSearchIndex === -1) {
            points.push({ latitude, longitude });
        } else {
            if (destination) points.push({ latitude: destination.latitude, longitude: destination.longitude });
        }

        const cleanPoints = points.filter(p => p && p.latitude && p.longitude);
        if (cleanPoints.length >= 2) {
            const route = await getRoute(cleanPoints);
            if (route) {
                setRouteInfo({
                    distance: parseFloat(route.distance.toFixed(2)),
                    duration: Math.ceil(route.duration)
                });
                setRouteCoordinates(route.coordinates);
                const pricing = calculateSuggestedPrice(route.distance, route.duration);
                setPriceSuggestions(generatePriceSuggestions(pricing.suggestedPrice));
                setSelectedPrice(pricing.suggestedPrice);
                setMinPrice(pricing.suggestedPrice);
                setCustomPrice(pricing.suggestedPrice.toString());

                if (mapRef.current && route.coordinates.length > 0) {
                    const bounds = route.coordinates.map(c => [c.lat, c.lng]);
                    mapRef.current.injectJavaScript(`
if (window.map) {
    window.map.fitBounds(${JSON.stringify(bounds)}, { padding: [50, 50] });
}
`);
                }
            }
        }

        if (!isSilent) {
            const details = await getPlaceDetails(latitude, longitude);
            if (activeSearchIndex === -2) {
                setPickupName(details.address);
            } else if (activeSearchIndex === -1) {
                setDestinationName(details.address);
            } else {
                const newStops = [...stops];
                newStops[activeSearchIndex] = { ...newStops[activeSearchIndex], name: details.address };
                setStops(newStops);
            }
        }
    };

    // Inyectar Zoom Táctil Pro en el Mapa y ocultar controles nativos (FORCED L7)
    const pinchToZoomJS = `
    (function() {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
        document.getElementsByTagName('head')[0].appendChild(meta);
        const style = document.createElement('style');
        style.innerHTML = '.leaflet-control-zoom, .leaflet-control-attribution, .leaflet-control-locate, .leaflet-top.leaflet-left, .leaflet-bottom.leaflet-right, .leaflet-control { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';
        document.head.appendChild(style);
        function cleanMap() {
            const controls = document.querySelectorAll('.leaflet-control');
            controls.forEach(c => { c.style.display = 'none'; c.style.visibility = 'hidden'; });
        }
        window.L.Map.addInitHook(function() {
            this.touchZoom.enable();
            this.doubleClickZoom.enable();
            this.boxZoom.enable();
            if (this.zoomControl) this.zoomControl.remove();
            cleanMap();
        });
        setTimeout(cleanMap, 1000);
        setTimeout(cleanMap, 3000);
    })();
    true;
`;

    const handleMapMessage = (message) => {
        if (message.event === 'onMapClick' && isMapPickerMode) {
            const { lat, lng } = message.payload;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
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

    const removeStop = async (index) => {
        const newStops = stops.filter((_, i) => i !== index);
        setStops(newStops);

        const currentPickup = pickupLocation || myLocation;
        const points = [{ latitude: currentPickup.latitude, longitude: currentPickup.longitude }];
        newStops.forEach(s => {
            if (s.latitude && s.longitude) points.push(s);
        });
        if (destination) points.push(destination);

        if (points.length >= 2) {
            const route = await getRoute(points);
            if (route) {
                setRouteInfo({
                    distance: parseFloat(route.distance.toFixed(2)),
                    duration: Math.ceil(route.duration)
                });
                setRouteCoordinates(route.coordinates);
                const pricing = calculateSuggestedPrice(route.distance, route.duration);
                setPriceSuggestions(generatePriceSuggestions(pricing.suggestedPrice));
                setSelectedPrice(pricing.suggestedPrice);
                setMinPrice(pricing.suggestedPrice);
                setCustomPrice(pricing.suggestedPrice.toString());
            }
        } else {
            setRouteInfo({ distance: 0, duration: 0 });
            setRouteCoordinates([]);
            setPriceSuggestions([]);
        }
    };

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.length >= 2) {
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
        const finalPrice = Number(customPrice);
        if (!finalPrice || finalPrice < minPrice) {
            Alert.alert('Precio inválido', `El monto no puede ser menor a ₡${minPrice} (Tarifa calculada)`);
            return;
        }

        // --- CRASH FIX ---
        // Validate destination is set before attempting to read its properties
        if (!destination || !destination.latitude || !destination.longitude) {
            Alert.alert('Destino Requerido', 'Por favor selecciona un destino válido antes de solicitar el viaje.');
            return;
        }

        try {
            setRideStatus('searching');
            const rideData = {
                riderId: user.uid,
                riderName: userData?.name || 'Pasajero',
                riderRating: userData?.rating || 5.0,
                status: 'pending',
                pickup: {
                    latitude: pickupLocation?.latitude || myLocation.latitude,
                    longitude: pickupLocation?.longitude || myLocation.longitude,
                    name: pickupName,
                },
                dropoff: {
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                    name: destinationName,
                },
                dropoffs: [
                    ...stops.filter(s => s.latitude && s.longitude).map(s => ({ latitude: s.latitude, longitude: s.longitude, name: s.name })),
                    {
                        latitude: destination.latitude,
                        longitude: destination.longitude,
                        name: destinationName,
                    }
                ],
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
            setCurrentRideId(rideRef.id);

            const unsubscribe = onSnapshot(rideRef, (doc) => {
                const data = doc.data();
                if (data?.status === 'accepted') {
                    setRideStatus('found');
                    setCurrentRideId(null);
                    setRideUnsubscribe(null);
                    unsubscribe();
                    navigation.navigate('RideTracking', {
                        rideId: rideRef.id,
                        driverId: data.driverId,
                    });
                }
            });
            setRideUnsubscribe(() => unsubscribe);

            Alert.alert('¡Enviado!', 'Buscando chofer cercano...');
        } catch (error) {
            Alert.alert('Error', 'No se pudo enviar la solicitud');
            setRideStatus(null);
            setCurrentRideId(null);
        }
    };

    const cancelRideRequest = async () => {
        try {
            if (rideUnsubscribe) {
                rideUnsubscribe();
                setRideUnsubscribe(null);
            }
            if (currentRideId) {
                await updateDoc(doc(db, 'rides', currentRideId), { status: 'cancelled' });
                setCurrentRideId(null);
            }
            setRideStatus(null);
        } catch (error) {
            console.error('Error cancelling ride:', error);
            setRideStatus(null);
            setCurrentRideId(null);
        }
    };

    const selectSearchResult = async (item) => {
        if (activeSearchIndex === -2) {
            // MANUAL PICKUP SELECTION
            setPickupLocation({ latitude: item.latitude, longitude: item.longitude });
            setPickupName(item.address || item.name || item.shortName);
            setIsManualPickup(true);
        } else if (activeSearchIndex === -1) {
            setDestination({ latitude: item.latitude, longitude: item.longitude });
            setDestinationName(item.name || item.shortName || item.address);
        } else {
            const newStops = [...stops];
            newStops[activeSearchIndex] = { latitude: item.latitude, longitude: item.longitude, name: item.name || item.shortName || item.address };
            setStops(newStops);
        }

        setSearchQuery('');
        setSearchResults([]);

        if (mapRef.current) {
            mapRef.current.injectJavaScript(`
window.map.flyTo([${item.latitude}, ${item.longitude}], 16);
`);
        }

        if (myLocation) {
            try {
                const validStops = stops.filter(s => s.latitude && s.longitude);
                const currentPickup = pickupLocation || myLocation;
                const points = [
                    { latitude: currentPickup.latitude, longitude: currentPickup.longitude },
                    ...validStops,
                ];
                if (activeSearchIndex === -1) {
                    points.push({ latitude: item.latitude, longitude: item.longitude });
                } else {
                    points[activeSearchIndex + 1] = { latitude: item.latitude, longitude: item.longitude };
                    if (destination) points.push({ latitude: destination.latitude, longitude: destination.longitude });
                }

                const cleanPoints = points.filter(p => p && p.latitude && p.longitude);
                const route = await getRoute(cleanPoints);
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

                    const pricing = calculateSuggestedPrice(route.distance, route.duration);
                    const suggestions = generatePriceSuggestions(pricing.suggestedPrice);
                    setPriceSuggestions(suggestions);
                    setSelectedPrice(pricing.suggestedPrice);
                    setMinPrice(pricing.suggestedPrice);
                    setCustomPrice(pricing.suggestedPrice.toString());
                } else {
                    const currentPickup = pickupLocation || myLocation;
                    const dist = calculateDistance(
                        currentPickup.latitude, currentPickup.longitude,
                        item.latitude, item.longitude
                    );
                    const pricing = calculateSuggestedPrice(dist || 0);
                    setMinPrice(pricing.suggestedPrice);
                    setSelectedPrice(pricing.suggestedPrice);
                    setCustomPrice(pricing.suggestedPrice.toString());
                    setRouteInfo({
                        distance: pricing.distanceKm || 0,
                        duration: pricing.estimatedMinutes || 2
                    });
                    setRouteCoordinates([]);
                }
            } catch (error) {
                console.error("Error fetching route in selectSearchResult:", error);
            }
        }
        if (!showPanel) togglePanel();
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
                            zoomControl={false}
                            injectedJavaScript={pinchToZoomJS}
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
                                    icon: '📍 A', // Start is always A
                                    size: [32, 32],
                                },
                                ...stops.filter(s => s.latitude && s.longitude).map((s, index) => ({
                                    id: `stop - ${index} `,
                                    position: { lat: s.latitude, lng: s.longitude },
                                    icon: `📍 ${String.fromCharCode(66 + index)} `, // B, C, D...
                                    size: [32, 32],
                                })),
                                ...(destination ? [{
                                    id: 'destination',
                                    position: { lat: destination.latitude, lng: destination.longitude },
                                    icon: `📍 ${String.fromCharCode(66 + stops.filter(s => s.latitude && s.longitude).length)} `, // Always the last letter
                                    size: [32, 32],
                                }] : []),
                                // Online drivers
                                ...drivers.map(d => ({
                                    id: `driver - ${d.id} `,
                                    position: { lat: d.location.latitude, lng: d.location.longitude },
                                    icon: '🟢🚗',
                                    size: [32, 32],
                                })),
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
                    </View>
                )}

                {!isMapPickerMode && (
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Text style={{ fontSize: moderateScale(18), marginRight: 10 }}>🔍</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder={
                                    activeSearchIndex === -2 ? "📍 ¿Dónde te recojo?" :
                                        activeSearchIndex === -1 ? "🏁 ¿A dónde vamos?" :
                                            `📍 Agregar Parada ${activeSearchIndex + 1} `
                                }
                                placeholderTextColor={COLORS.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onFocus={() => {
                                    if (!showPanel) togglePanel();
                                }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <View style={styles.clearBadge}>
                                        <Text style={styles.clearIconText}>✕</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Controles de Mapa Horizontales (Surgical Fix L7+) */}
                        <View style={styles.horizontalControls}>
                            <View style={styles.hControlGroup}>
                                <TouchableOpacity
                                    style={styles.hButton}
                                    onPress={() => {
                                        const nextZoom = Math.min(mapZoom + 1, 19);
                                        setMapZoom(nextZoom);
                                        mapRef.current?.injectJavaScript(`window.map.setZoom(${nextZoom})`);
                                    }}
                                >
                                    <Text style={styles.hButtonText}>+</Text>
                                </TouchableOpacity>
                                <View style={styles.hDivider} />
                                <TouchableOpacity
                                    style={styles.hButton}
                                    onPress={() => {
                                        const nextZoom = Math.max(mapZoom - 1, 5);
                                        setMapZoom(nextZoom);
                                        mapRef.current?.injectJavaScript(`window.map.setZoom(${nextZoom})`);
                                    }}
                                >
                                    <Text style={styles.hButtonText}>−</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.hGpsButton}
                                onPress={async () => {
                                    try {
                                        const loc = await getCurrentLocation();
                                        setMyLocation(loc);
                                        if (mapRef.current) {
                                            mapRef.current.injectJavaScript(`window.map.flyTo([${loc.latitude}, ${loc.longitude}], 16); `);
                                        }
                                    } catch (error) {
                                        Alert.alert('Error', 'No se pudo obtener la ubicación');
                                    }
                                }}
                            >
                                <Text style={{ fontSize: moderateScale(20) }}>🎯</Text>
                            </TouchableOpacity>
                        </View>

                        {(searchResults.length > 0 || activeSearchIndex === -2) && (
                            <Animated.View style={[styles.resultsContainer, { opacity: slideAnim, maxHeight: 400 }]}>
                                {activeSearchIndex === -2 && (
                                    <TouchableOpacity
                                        style={styles.currentLocResult}
                                        onPress={async () => {
                                            setIsManualPickup(false);
                                            const loc = await getCurrentLocation();
                                            setMyLocation(loc);
                                            setPickupLocation(loc);
                                            const addr = await reverseGeocode(loc.latitude, loc.longitude);
                                            setPickupName(addr);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                            if (mapRef.current) {
                                                mapRef.current.injectJavaScript(`window.map.flyTo([${loc.latitude}, ${loc.longitude}], 16); `);
                                            }
                                        }}
                                    >
                                        <Text style={{ fontSize: moderateScale(20) }}>🎯</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.currentLocTitle}>Ubicación Actual</Text>
                                            <Text style={styles.currentLocSubtitle} numberOfLines={1}>Tocar para resetear GPS</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {searchResults.length > 0 && (
                                    <>
                                        <View style={{ marginBottom: SPACING.md, alignItems: 'center', marginTop: activeSearchIndex === -2 ? 10 : 0 }}>
                                            <Text style={styles.summaryTitle}>Resultados de Búsqueda</Text>
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
                                    </>
                                )}
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
                                    {routeInfo?.distance || '0.0'} km
                                </Text>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricItem}>
                                <Text style={styles.metricEmoji}>⏱️</Text>
                                <Text style={styles.metricValue}>
                                    {routeInfo?.duration || '2'} min
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.confirmMapPicker}
                            onPress={async () => {
                                setIsMapPickerMode(false);
                                let lat, lng;
                                if (activeSearchIndex === -2) {
                                    lat = myLocation.latitude;
                                    lng = myLocation.longitude;
                                } else if (activeSearchIndex === -1) {
                                    lat = destination.latitude;
                                    lng = destination.longitude;
                                } else {
                                    lat = stops[activeSearchIndex].latitude;
                                    lng = stops[activeSearchIndex].longitude;
                                }

                                const details = await getPlaceDetails(lat, lng);

                                if (activeSearchIndex === -2) {
                                    setPickupName(details.address);
                                } else if (activeSearchIndex === -1) {
                                    setDestinationName(details.address);
                                } else {
                                    const newStops = [...stops];
                                    newStops[activeSearchIndex].name = details.address;
                                    setStops(newStops);
                                }

                                if (!showPanel) togglePanel();
                            }}
                        >
                            <Text style={styles.confirmMapPickerText}>Confirmar Destino</Text>
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.bottomSection}>


                    {!isMapPickerMode && (
                        <Animated.View
                            style={[
                                styles.requestPanel,
                                { transform: [{ translateY: panelTranslateY }] },
                            ]}
                        >
                            <ScrollView
                                style={{ maxHeight: SCREEN_HEIGHT * 0.55 }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={styles.locationRow}>
                                    <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
                                    <View style={styles.locationInfo}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.locationLabel}>Punto de Recogida (A)</Text>
                                            <TouchableOpacity
                                                style={styles.stopActionBtn}
                                                onPress={() => {
                                                    setActiveSearchIndex(-2); // -2 is manual pickup search
                                                    setSearchQuery('');
                                                }}
                                            >
                                                <Text style={styles.stopActionEdit}>✏️</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.locationName} numberOfLines={2}>{pickupName || 'Tu ubicación actual'}</Text>
                                    </View>
                                </View>

                                {stops.map((stop, index) => (
                                    <View key={index} style={styles.locationRow}>
                                        <View style={[styles.locationDot, { backgroundColor: COLORS.warning }]} />
                                        <View style={styles.locationInfo}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={styles.locationLabel}>Parada {String.fromCharCode(66 + index)}</Text>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    <TouchableOpacity
                                                        style={styles.stopActionBtn}
                                                        onPress={() => removeStop(index)}
                                                    >
                                                        <Text style={styles.stopActionRemove}>➖</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.stopActionBtn}
                                                        onPress={() => {
                                                            setActiveSearchIndex(index);
                                                            setSearchQuery('');
                                                        }}
                                                    >
                                                        <Text style={styles.stopActionEdit}>✏️</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            <Text style={styles.locationName} numberOfLines={2}>
                                                {stop.name || 'Buscando...'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}

                                <View style={styles.locationRow}>
                                    <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
                                    <View style={styles.locationInfo}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.locationLabel}>Destino Final ({String.fromCharCode(66 + stops.filter(s => s?.latitude).length)})</Text>
                                            <TouchableOpacity
                                                style={styles.stopActionBtn}
                                                onPress={() => {
                                                    setActiveSearchIndex(-1);
                                                    if (!destination && myLocation) {
                                                        setDestination({ latitude: myLocation.latitude, longitude: myLocation.longitude });
                                                    }
                                                    setIsMapPickerMode(true);
                                                    if (showPanel) togglePanel();
                                                }}
                                            >
                                                <Text style={styles.stopActionEdit}>🗺️</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.locationName} numberOfLines={2}>
                                            {destinationName || 'Selecciona un destino'}
                                        </Text>
                                    </View>
                                </View>

                                {stops.length < 3 && destination && (
                                    <View style={styles.addStopRow}>
                                        <View style={styles.addStopLine} />
                                        <TouchableOpacity
                                            style={styles.addStopBtn}
                                            onPress={() => {
                                                const newIndex = stops.length;
                                                setStops([...stops, { latitude: null, longitude: null, name: '' }]);
                                                setActiveSearchIndex(newIndex);
                                                if (showPanel) togglePanel(); // Collapse panel to bring focus to the search bar
                                            }}
                                        >
                                            <Text style={styles.addStopEmoji}>➕</Text>
                                            <Text style={styles.addStopText}>Añadir Parada</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>

                            <View style={styles.fixedBottomContainer}>
                                {/* Price Suggestions */}

                                <ScrollView
                                    horizontal={true}
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingVertical: 10 }}
                                >
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
                                                            styles.priceChipText,
                                                            selectedPrice === item.price && styles.priceChipTextActive
                                                        ]}>
                                                            {item.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </ScrollView>

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

                {
                    rideStatus === 'searching' && (
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
                                <Text style={styles.searchingSub}>Estamos conectándote con la flota de Elysium Vanguard Driving en Costa Rica...</Text>

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
                                    onPress={cancelRideRequest}
                                >
                                    <Text style={styles.cancelRequestText}>Cancelar Solicitud</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )
                }
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
        top: SAFE_TOP,
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
        top: SAFE_TOP,
        left: scale(75),
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
        paddingRight: 10,
    },
    clearBadge: {
        backgroundColor: COLORS.border,
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearIconText: {
        color: COLORS.textMuted,
        fontSize: moderateScale(12),
        fontWeight: 'bold',
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
        fontSize: moderateScale(18),
        marginRight: scale(12),
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    resultAddress: {
        fontSize: moderateScale(12),
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
        backgroundColor: COLORS.glassBg,
        borderRadius: RADIUS.xl,
        paddingHorizontal: scale(SPACING.lg),
        paddingVertical: scale(18),
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.neonBlue,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    whereToIcon: {
        fontSize: moderateScale(20),
        marginRight: scale(SPACING.sm),
    },
    whereToText: {
        flex: 1,
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        color: COLORS.neonBlue,
    },
    whereToArrow: {
        fontSize: moderateScale(18),
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    requestPanel: {
        backgroundColor: COLORS.glassBg,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.neonBlue,
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: { elevation: 20 },
        }),
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        padding: 10,
        backgroundColor: COLORS.bgCard + '88',
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border + '22',
    },
    locationDot: {
        width: scale(10),
        height: scale(10),
        borderRadius: scale(5),
        marginRight: scale(15),
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5,
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: moderateScale(10),
        color: COLORS.neonBlue,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 'bold',
    },
    addStopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    addStopLine: {
        width: 2,
        height: 20,
        backgroundColor: COLORS.neonBlue + '44',
        marginLeft: 7,
        marginRight: 15,
    },
    addStopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.neonBlue + '22',
        borderWidth: 1,
        borderColor: COLORS.neonBlue,
        borderRadius: RADIUS.md,
    },
    addStopEmoji: {
        fontSize: 14,
        marginRight: 6,
    },
    addStopText: {
        color: COLORS.neonBlue,
        fontWeight: 'bold',
        fontSize: 14,
    },
    locationName: {
        fontSize: moderateScale(15),
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    mapPickText: {
        fontSize: moderateScale(12),
        color: COLORS.neonPurple,
        fontWeight: 'bold',
    },
    stopActionBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border + '66',
    },
    stopActionRemove: {
        fontSize: 14,
    },
    stopActionEdit: {
        fontSize: 14,
    },
    priceSection: {
        marginVertical: SPACING.sm,
    },
    priceSectionTitle: {
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        color: COLORS.neonBlue,
        marginBottom: scale(8),
        textTransform: 'uppercase',
    },
    priceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    priceSuggestion: {
        backgroundColor: COLORS.bgCard + 'CC',
        paddingVertical: scale(12),
        paddingHorizontal: scale(10),
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexBasis: DEVICE_SIZE.DESKTOP ? '24%' : (DEVICE_SIZE.TABLET ? '31%' : (DEVICE_SIZE.SMALL ? '95%' : '48%')),
        alignItems: 'center',
        justifyContent: 'center',
    },
    priceText: {
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    priceChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '11',
    },
    priceChipText: {
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    priceChipTextActive: {
        color: COLORS.accent,
    },
    customPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard + 'AA',
        borderRadius: RADIUS.md,
        marginTop: scale(10),
        paddingHorizontal: scale(15),
        borderWidth: 1,
        borderColor: COLORS.neonBlue + '44',
    },
    currencySymbol: {
        fontSize: moderateScale(20),
        fontWeight: 'bold',
        color: COLORS.neonGreen,
    },
    customPriceInput: {
        flex: 1,
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        color: COLORS.neonGreen,
        paddingVertical: scale(10),
        marginLeft: scale(5),
    },
    paymentRow: {
        flexDirection: 'row',
        gap: scale(10),
        marginVertical: scale(15),
    },
    paymentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bgCard + '88',
        paddingVertical: scale(12),
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border + '44',
        gap: scale(8),
    },
    paymentBtnActive: {
        borderColor: COLORS.neonPurple,
        backgroundColor: COLORS.neonPurple + '22',
    },
    paymentEmoji: { fontSize: moderateScale(18) },
    paymentText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: moderateScale(14) },
    paymentTextActive: { color: COLORS.neonPurple, fontWeight: 'bold' },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(25),
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelBtnText: { fontSize: moderateScale(20), color: COLORS.textSecondary },
    sendBtn: {
        flex: 1,
        backgroundColor: COLORS.neonBlue,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        height: scale(50),
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: scale(10),
        elevation: 10,
    },
    sendBtnSearching: {
        backgroundColor: COLORS.textMuted,
    },
    sendBtnText: {
        color: '#fff',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContent: {
        width: DEVICE_SIZE.TABLET || DEVICE_SIZE.DESKTOP ? scale(300) : width * 0.75,
        height: '100%',
        backgroundColor: COLORS.bgPrimary,
        borderRightWidth: 1,
        borderRightColor: COLORS.neonBlue + '44',
    },
    menuHeader: {
        padding: scale(30),
        backgroundColor: COLORS.bgCard,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    userAvatarLarge: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: COLORS.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(15),
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    menuUserName: {
        fontSize: moderateScale(20),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: scale(5),
    },
    ratingBadgeContainer: {
        alignItems: 'center',
    },
    ratingPercent: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    recommendedBadge: {
        backgroundColor: COLORS.success + '22',
        paddingHorizontal: scale(10),
        paddingVertical: scale(4),
        borderRadius: scale(5),
        marginTop: scale(5),
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    recommendedText: {
        color: COLORS.success,
        fontSize: moderateScale(12),
        fontWeight: 'bold',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(20),
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border + '11',
    },
    menuItemIcon: { fontSize: moderateScale(20), marginRight: scale(15) },
    menuItemText: { fontSize: moderateScale(16), color: COLORS.textPrimary, fontWeight: '500' },
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
        padding: scale(30),
        alignItems: 'center',
    },
    searchingPulse: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: COLORS.accent + '22',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(20),
    },
    searchingEmoji: { fontSize: moderateScale(40) },
    searchingTitle: { fontSize: moderateScale(22), fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: scale(10) },
    resultAddress: { fontSize: moderateScale(11), color: COLORS.textMuted },

    currentLocResult: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(SPACING.md),
        backgroundColor: COLORS.neonBlue + '15',
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.neonBlue + '30',
        gap: scale(12),
    },
    currentLocTitle: {
        fontSize: moderateScale(14),
        fontWeight: '700',
        color: COLORS.neonBlue,
    },
    currentLocSubtitle: {
        fontSize: moderateScale(11),
        color: COLORS.textMuted,
    },
    searchingSub: { fontSize: moderateScale(14), color: COLORS.textMuted, textAlign: 'center', marginBottom: scale(30) },
    searchingProgressContainer: {
        width: '100%',
        height: scale(4),
        backgroundColor: COLORS.border,
        borderRadius: scale(2),
        overflow: 'hidden',
        marginVertical: scale(20),
    },
    searchingProgressBar: {
        width: '40%',
        height: '100%',
        backgroundColor: COLORS.accent,
        borderRadius: 2,
    },
    cancelRequestBtn: {
        paddingVertical: scale(12),
        paddingHorizontal: scale(25),
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelRequestText: { color: COLORS.error, fontWeight: 'bold', fontSize: moderateScale(14) },
    mapPickerContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    crosshairVertical: { width: 1, height: scale(40), backgroundColor: COLORS.accent, position: 'absolute' },
    crosshairHorizontal: { width: scale(40), height: 1, backgroundColor: COLORS.accent, position: 'absolute' },
    fixedPin: { marginBottom: scale(40) },
    fixedPinIcon: { fontSize: moderateScale(40) },
    pinPulse: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        backgroundColor: COLORS.accent + '44',
        position: 'absolute',
        bottom: scale(-10),
        left: scale(10),
    },
    pickerMetricsBox: {
        position: 'absolute',
        top: scale(100),
        flexDirection: 'row',
        backgroundColor: COLORS.bgCard,
        padding: scale(15),
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.accent,
        alignItems: 'center',
    },
    metricItem: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
    metricEmoji: { fontSize: moderateScale(14) },
    metricDivider: { width: 1, height: scale(20), backgroundColor: COLORS.border, marginHorizontal: scale(15) },
    confirmMapPicker: {
        position: 'absolute',
        bottom: scale(50),
        left: scale(20),
        right: scale(20),
        backgroundColor: COLORS.accent,
        padding: scale(15),
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: COLORS.accent,
                shadowOffset: { width: 0, height: scale(6) },
                shadowOpacity: 0.4,
                shadowRadius: scale(8),
            },
            android: { elevation: 12 },
        }),
    },
    confirmMapPickerText: { color: '#fff', fontSize: moderateScale(18), fontWeight: 'bold' },

    // Professional Map Controls (Horizontal Layout L7+)
    horizontalControls: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 8,
        alignItems: 'center',
    },
    hControlGroup: {
        flexDirection: 'row',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 5,
        overflow: 'hidden',
    },
    hButton: {
        width: scale(44),
        height: scale(44),
        justifyContent: 'center',
        alignItems: 'center',
    },
    hButtonText: {
        fontSize: moderateScale(24),
        color: COLORS.textPrimary,
        fontWeight: '300',
    },
    hDivider: {
        width: 1,
        height: '60%',
        backgroundColor: COLORS.border,
        alignSelf: 'center',
    },
    hGpsButton: {
        width: scale(44),
        height: scale(44),
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
});
