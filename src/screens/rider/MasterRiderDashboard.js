import React, { useState, useMemo } from 'react';
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
    TextInput
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// Componentes refactorizados
import LocationSearch from '../../components/LocationSearch';
import DynamicBottomSheet from '../../components/DynamicBottomSheet';

const { height, width } = Dimensions.get('window');

/**
 * MasterRiderDashboard - Versión Elite L7
 * Arquitectura de capas estricta, FitBounds con padding dinámico y búsqueda profesional.
 */
const MasterRiderDashboard = () => {
    // ESTADOS DE UI - panelY controla la posición del Bottom Sheet
    const panelY = useSharedValue(height); // Inicializado fuera de pantalla (totalmente colapsado)
    const [isSearching, setIsSearching] = useState(false);

    // ESTADOS DE UBICACIÓN
    const [pickup, setPickup] = useState(null);
    const [destination, setDestination] = useState(null);

    // ESTILOS ANIMADOS REACTIVOS (Capa 2: Controles del mapa)
    const mapControlsStyle = useAnimatedStyle(() => {
        // El Bottom Sheet restringido ahora está en 40vh (height * 0.4)
        // Calculamos el offset para que los controles floten 20px arriba del panel
        const sheetVisibleHeight = Math.max(0, height - panelY.value);
        return {
            bottom: withSpring(sheetVisibleHeight + 25, { damping: 15 }),
        };
    });

    // Gestión de Colapso Dinámico al Buscar
    const handleSearchFocus = () => {
        setIsSearching(true);
        panelY.value = withSpring(height, { damping: 20 }); // Colapso total
    };

    const handleLocationSelect = (loc, type) => {
        if (type === 'pickup') setPickup(loc);
        else setDestination(loc);

        setIsSearching(false);
        // Al seleccionar, abrimos el panel restringido (40vh visible -> panelY = 0.6 * height)
        panelY.value = withSpring(height * 0.6, { damping: 15 });

        // REGLA MAESTRA: FitBounds con Dynamic Padding
        console.log("ACCION: Ejecutar FitBounds con padding inferior de 40vh");
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Capa 0: El Mapa (Motor de fondo 100%) */}
            <View style={styles.mapContainer}>
                <LeafletView
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
                // Inyección de lógica de FitBounds reactiva aquí
                />
            </View>

            {/* Capa 1: Header Superior Directo - Sin superposiciones complejas */}
            <SafeAreaView style={styles.topUI} pointerEvents="box-none">
                <View style={styles.upperHeader}>
                    <TouchableOpacity style={styles.roundButton}>
                        <Ionicons name="menu" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <View style={styles.searchStack}>
                        <LocationSearch
                            placeholder="¿A dónde vamos?"
                            icon="search"
                            iconColor="#FFD600"
                            onFocus={handleSearchFocus}
                            onLocationSelect={(loc) => handleLocationSelect(loc, 'destination')}
                        />
                        {isSearching && (
                            <>
                                <View style={styles.searchDivider} />
                                <LocationSearch
                                    placeholder="Mi ubicación actual"
                                    icon="pin"
                                    iconColor="#888"
                                    onFocus={handleSearchFocus}
                                    onLocationSelect={(loc) => handleLocationSelect(loc, 'pickup')}
                                />
                            </>
                        )}
                    </View>
                </View>

                {/* Micro-atención visual */}
                {!isSearching && (
                    <TouchableOpacity style={styles.addStopButton}>
                        <BlurView intensity={30} tint="dark" style={styles.addStopBlur}>
                            <Ionicons name="add" size={18} color="#FFD600" />
                            <Text style={styles.addStopText}>Añadir parada</Text>
                        </BlurView>
                    </TouchableOpacity>
                )}
            </SafeAreaView>

            {/* Capa 2: Controles Flotantes Dinámicos */}
            <Animated.View style={[styles.mapControls, mapControlsStyle]}>
                <TouchableOpacity style={styles.controlButton}>
                    <Ionicons name="add" size={20} color="#FFF" />
                </TouchableOpacity>
                <View style={{ height: 10 }} />
                <TouchableOpacity style={styles.controlButton}>
                    <Ionicons name="remove" size={20} color="#FFF" />
                </TouchableOpacity>
                <View style={{ height: 15 }} />
                <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#FFD600' }]}>
                    <Ionicons name="locate" size={20} color="#000" />
                </TouchableOpacity>
            </Animated.View>

            {/* Capa 3: Bottom Sheet Dinámico Restringido (40vh) */}
            <DynamicBottomSheet translateY={panelY}>
                <Text style={styles.sheetTitle}>Estado del Viaje</Text>

                <View style={styles.priceInputContainer}>
                    <Text style={styles.currencySymbol}>₡</Text>
                    <TextInput
                        style={styles.priceInput}
                        placeholder="1500"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        keyboardType="numeric"
                    />
                </View>

                {/* Controles de Segmento Elite */}
                <View style={styles.optionsRow}>
                    <TouchableOpacity style={[styles.optionItem, styles.activeOption]}>
                        <Ionicons name="flash" size={18} color="#FFD600" />
                        <Text style={styles.optionLabel}>Prioridad</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.optionItem}>
                        <Ionicons name="leaf" size={18} color="#4CAF50" />
                        <Text style={[styles.optionLabel, { color: '#888' }]}>Ahorro</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.orderButton}>
                    <Text style={styles.orderButtonText}>SOLICITAR VIAJE NOW</Text>
                </TouchableOpacity>

                <View style={[styles.divider, { marginVertical: 30 }]} />

                <Text style={styles.historyTitle}>LUGARES RECIENTES</Text>
                {[
                    { id: '1', name: 'Multiplaza Escazú', icon: 'cart' },
                    { id: '2', name: 'Aeropuerto Juan Santamaría', icon: 'airplane' }
                ].map(item => (
                    <TouchableOpacity key={item.id} style={styles.recentItem}>
                        <View style={styles.locationIconCircle}>
                            <Ionicons name={item.icon} size={18} color="#888" />
                        </View>
                        <Text style={styles.recentText}>{item.name}</Text>
                    </TouchableOpacity>
                ))}
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
        zIndex: 100, // Debajo de los dropdowns de búsqueda pero sobre el mapa
    },
    upperHeader: {
        flexDirection: 'row',
        marginTop: Platform.OS === 'android' ? 45 : 10,
    },
    roundButton: {
        width: 55,
        height: 55,
        borderRadius: 28,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 10,
    },
    searchStack: {
        flex: 1,
        elevation: 10,
    },
    searchDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 4,
        marginHorizontal: 10,
    },
    addStopButton: {
        alignSelf: 'flex-start',
        marginTop: 20,
        marginLeft: 65,
    },
    addStopBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    addStopText: {
        color: '#FFF',
        fontSize: 14,
        marginLeft: 8,
        fontWeight: '600',
    },
    mapControls: {
        position: 'absolute',
        right: 15,
        zIndex: 80, // Encima del mapa
    },
    controlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(10,10,10,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 5,
    },
    sheetTitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 20,
        textAlign: 'center',
    },
    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 25,
    },
    currencySymbol: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: '900',
        marginRight: 12,
    },
    priceInput: {
        color: '#FFF',
        fontSize: 52,
        fontWeight: '900',
        minWidth: 120,
    },
    optionsRow: {
        flexDirection: 'row',
        marginBottom: 30,
        justifyContent: 'space-between',
    },
    optionItem: {
        flex: 0.48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeOption: {
        borderColor: 'rgba(255,214,0,0.3)',
        backgroundColor: 'rgba(255,214,0,0.05)',
    },
    optionLabel: {
        color: '#FFF',
        marginLeft: 10,
        fontSize: 15,
        fontWeight: '600',
    },
    orderButton: {
        backgroundColor: '#FFD600',
        height: 65,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFD600',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10,
    },
    orderButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    historyTitle: {
        color: '#555',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 20,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    locationIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    recentText: {
        color: '#CCC',
        fontSize: 15,
        fontWeight: '500',
    }
});

export default MasterRiderDashboard;
