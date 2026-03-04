import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Dimensions,
    TouchableOpacity,
    Text,
    SafeAreaView,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    TextInput,
    BackHandler,
    ToastAndroid,
    PanResponder
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    runOnJS
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// Componentes refactorizados
import LocationSearch from '../../components/LocationSearch';
import DynamicBottomSheet from '../../components/DynamicBottomSheet';

const { height, width } = Dimensions.get('window');

/**
 * MasterRiderDashboard - Versión Elite L7+ (Elysium Final)
 * Solución integral a superposiciones, flujo bloqueado y navegación nativa.
 */
const MasterRiderDashboard = () => {
    // ESTADOS DE UI
    const panelY = useSharedValue(height);
    const [isSearching, setIsSearching] = useState(false);
    const [searchType, setSearchType] = useState('destination'); // 'pickup' o 'destination'
    const [lastBackPressed, setLastBackPressed] = useState(0);

    // ESTADOS DE UBICACIÓN
    const [pickup, setPickup] = useState({ name: 'Alajuelita', lat: 9.9000, lng: -84.1000 });
    const [destination, setDestination] = useState(null);

    // Lógica de Doble Toque para Salir (Android)
    useEffect(() => {
        const backAction = () => {
            if (isSearching) {
                setIsSearching(false);
                panelY.value = withSpring(destination ? height * 0.6 : height, { damping: 20 });
                return true;
            }

            const now = Date.now();
            if (lastBackPressed && now - lastBackPressed < 2000) {
                BackHandler.exitApp();
                return true;
            }
            setLastBackPressed(now);
            if (Platform.OS === 'android') {
                ToastAndroid.show('Presione otra vez para salir', ToastAndroid.SHORT);
            }
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [isSearching, lastBackPressed, destination]);

    // ESTILOS ANIMADOS (Controles del mapa en barra lateral derecha)
    const mapControlsStyle = useAnimatedStyle(() => {
        const sheetVisibleHeight = Math.max(0, height - panelY.value);
        return {
            bottom: withSpring(sheetVisibleHeight + 40, { damping: 15 }),
        };
    });

    const handleSearchFocus = (type) => {
        setSearchType(type);
        setIsSearching(true);
        panelY.value = withSpring(height, { damping: 20 });
    };

    const handleLocationSelect = (loc) => {
        if (searchType === 'pickup') {
            setPickup(loc);
            if (!destination) {
                setSearchType('destination');
                return;
            }
        } else {
            setDestination(loc);
        }

        setIsSearching(false);
        panelY.value = withSpring(height * 0.6, { damping: 15 });
    };

    // INGENIERÍA DE GESTOS: PanResponder para expansión/colapso
    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
            // Permitir arrastre manual (limitado)
            const newVal = panelY.value + gestureState.dy * 0.5;
            if (newVal > height * 0.1 && newVal < height) {
                panelY.value = newVal;
            }
        },
        onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dy < -50) {
                // Deslizar arriba -> Expandir (Máximo 30% desde arriba)
                panelY.value = withSpring(height * 0.3, { damping: 20 });
            } else if (gestureState.dy > 50) {
                // Deslizar abajo -> Colapsar (60% desde arriba)
                panelY.value = withSpring(height * 0.6, { damping: 20 });
            } else {
                // Volver al estado actual más cercano
                const target = panelY.value < height * 0.45 ? height * 0.3 : height * 0.6;
                panelY.value = withSpring(target, { damping: 20 });
            }
        },
    });

    // Inyectar Zoom Táctil Pro en el Mapa y ocultar controles nativos
    const pinchToZoomJS = `
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
        document.getElementsByTagName('head')[0].appendChild(meta);
        
        // Estilos para ocultar controles nativos y attribution
        const style = document.createElement('style');
        style.innerHTML = '.leaflet-control-zoom, .leaflet-control-attribution, .leaflet-control-locate { display: none !important; }';
        document.head.appendChild(style);

        window.L.Map.addInitHook(function() {
            this.touchZoom.enable();
            this.doubleClickZoom.enable();
            this.boxZoom.enable();
            this.zoomControl.remove();
            console.log("Elite Map Gestures Enabled & Native Controls Hidden");
        });
        true;
    `;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Capa 0: El Mapa (Totalmente limpio de controles nativos) */}
            <View style={styles.mapContainer}>
                <LeafletView
                    doDebug={false}
                    injectedJavaScript={pinchToZoomJS}
                    mapLayers={[
                        {
                            baseLayerName: 'CartoDB Dark',
                            baseLayerIsChecked: true,
                            layerType: 'TileLayer',
                            baseLayer: true,
                            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                            attribution: '&copy; CartoDB',
                        }
                    ]}
                    zoomControl={false}
                />
            </View>

            {/* Capa 1: Header y Selección de Ruta */}
            <SafeAreaView style={styles.topUI} pointerEvents="box-none">
                <View style={styles.upperHeader}>
                    <TouchableOpacity style={styles.menuButton}>
                        <BlurView intensity={20} tint="dark" style={styles.fullFill}>
                            <Ionicons name="menu" size={26} color="#FFF" />
                        </BlurView>
                    </TouchableOpacity>

                    <View style={styles.searchStack}>
                        <LocationSearch
                            placeholder={searchType === 'pickup' ? "Punto de Recogida (A)" : "¿A dónde vamos?"}
                            icon={searchType === 'pickup' ? "pin" : "search"}
                            iconColor={searchType === 'pickup' ? "#4CAF50" : "#FFD600"}
                            onFocus={() => handleSearchFocus(searchType)}
                            onLocationSelect={handleLocationSelect}
                            autoFocus={isSearching}
                        />
                    </View>
                </View>

                {/* Chips de Estado (No superpuestos, flotantes) */}
                {!isSearching && (
                    <View style={styles.locationChips}>
                        <TouchableOpacity
                            style={[styles.chip, pickup && styles.activeChip]}
                            onPress={() => handleSearchFocus('pickup')}
                        >
                            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                            <Text numberOfLines={1} style={styles.chipText}>
                                {pickup ? pickup.name : 'Recogida'}
                            </Text>
                            <Ionicons name="pencil" size={12} color="#FFF" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.chip, destination && styles.activeChip]}
                            onPress={() => handleSearchFocus('destination')}
                        >
                            <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
                            <Text numberOfLines={1} style={styles.chipText}>
                                {destination ? destination.name : 'Destino'}
                            </Text>
                            <Ionicons name="search" size={12} color="#FFF" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>

            {/* Capa 2: Barra Lateral de Controles (Surgical Fix - Floating at center-right) */}
            <Animated.View style={[styles.sidebarControls, mapControlsStyle]}>
                <View style={[styles.controlGroup, { marginBottom: 10 }]}>
                    <TouchableOpacity style={styles.sidebarButton}>
                        <Ionicons name="add" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.sidebarDivider} />
                    <TouchableOpacity style={styles.sidebarButton}>
                        <Ionicons name="remove" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.sidebarButton, styles.gpsButton]}>
                    <Ionicons name="locate" size={24} color="#000" />
                </TouchableOpacity>
            </Animated.View>

            {/* Capa 3: Panel Inferior Desmonolizado con PanResponder */}
            <DynamicBottomSheet translateY={panelY} panHandlers={panResponder.panHandlers}>
                <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>VIAJE SELECCIONADO</Text>
                    <View style={styles.priceTag}>
                        <Text style={styles.priceValue}>₡1.500</Text>
                    </View>
                </View>

                <View style={styles.individualControls}>
                    <TouchableOpacity style={styles.actionCard}>
                        <View style={styles.cardIcon}>
                            <Ionicons name="flash" size={22} color="#FFD600" />
                        </View>
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle}>Elysium Priority</Text>
                            <Text style={styles.cardSub}>Llega en 3 min</Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={24} color="#FFD600" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionCard, { opacity: 0.6 }]}>
                        <View style={[styles.cardIcon, { backgroundColor: '#1B5E20' }]}>
                            <Ionicons name="leaf" size={22} color="#4CAF50" />
                        </View>
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle}>Elysium Green</Text>
                            <Text style={styles.cardSub}>Opción económica</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.paymentButtonRow}>
                        <TouchableOpacity style={styles.paymentMethod}>
                            <Ionicons name="card" size={20} color="#FFF" />
                            <Text style={styles.paymentText}>•••• 4242</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.promoButton}>
                            <Ionicons name="pricetag" size={18} color="#FFD600" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.mainRequestButton}>
                        <Text style={styles.mainRequestText}>CONFIRMAR ELYSIUM</Text>
                    </TouchableOpacity>
                </View>
            </DynamicBottomSheet>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    mapContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    topUI: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 15,
        zIndex: 100,
    },
    upperHeader: {
        flexDirection: 'row',
        marginTop: Platform.OS === 'android' ? 45 : 10,
        alignItems: 'center',
    },
    menuButton: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.8)',
        marginRight: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 8,
    },
    fullFill: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchStack: {
        flex: 1,
        elevation: 10,
    },
    locationChips: {
        flexDirection: 'row',
        marginTop: 15,
        gap: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10,10,10,0.9)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        maxWidth: width * 0.45,
    },
    activeChip: {
        borderColor: 'rgba(255,255,255,0.3)',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    chipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    sidebarControls: {
        position: 'absolute',
        right: 20,
        zIndex: 80,
        alignItems: 'center',
        paddingVertical: 10,
    },
    controlGroup: {
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 5,
    },
    sidebarButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sidebarDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        width: '60%',
        alignSelf: 'center',
    },
    gpsButton: {
        backgroundColor: '#FFD600',
        borderRadius: 15,
        elevation: 5,
    },
    mapTypeButton: {
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    sheetTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    priceTag: {
        backgroundColor: 'rgba(255,214,0,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,214,0,0.3)',
    },
    priceValue: {
        color: '#FFD600',
        fontWeight: '900',
        fontSize: 16,
    },
    individualControls: {
        gap: 12,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    cardIcon: {
        width: 45,
        height: 45,
        borderRadius: 12,
        backgroundColor: 'rgba(255,214,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    cardSub: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    paymentButtonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    paymentMethod: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        borderRadius: 15,
        gap: 10,
    },
    paymentText: {
        color: '#CCC',
        fontWeight: '600',
    },
    promoButton: {
        width: 55,
        height: 55,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainRequestButton: {
        backgroundColor: '#FFD600',
        height: 60,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 5,
        shadowColor: '#FFD600',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    mainRequestText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    }
});

export default MasterRiderDashboard;
