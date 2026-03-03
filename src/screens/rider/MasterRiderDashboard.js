import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Dimensions,
    TouchableOpacity,
    Text,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// Nuevos componentes refactorizados
import LocationSearch from '../../components/LocationSearch';
import DynamicBottomSheet from '../../components/DynamicBottomSheet';

const { height, width } = Dimensions.get('window');

const MasterRiderDashboard = () => {
    // ESTADOS DE UI
    const panelY = useSharedValue(height * 0.65); // Posición inicial del Bottom Sheet

    // ESTADOS DE UBICACIÓN
    const [pickup, setPickup] = useState(null);
    const [destination, setDestination] = useState(null);

    // ESTILOS ANIMADOS REACTIVOS (Capa 1: Controles del mapa)
    const mapControlsStyle = useAnimatedStyle(() => {
        const bottomOffset = interpolate(
            panelY.value,
            [height * 0.35, height * 0.65],
            [height * 0.7, height * 0.4], // Sube cuando el panel sube
            'clamp'
        );
        return {
            bottom: bottomOffset,
        };
    });

    const handleExpand = () => {
        panelY.value = withSpring(height * 0.35, { damping: 15 });
    };

    const handleCollapse = () => {
        panelY.value = withSpring(height * 0.65, { damping: 15 });
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* CAPA 0: MAPA (FONDO) */}
            <View style={styles.mapContainer}>
                <LeafletView
                    mapLayers={[{
                        baseLayerName: 'CartoDB DarkMatter',
                        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                    }]}
                    zoom={15}
                />
            </View>

            {/* CAPA 2: UI SUPERIOR FIJA (SEARCH & MENU) */}
            <SafeAreaView style={styles.topUI}>
                <View style={styles.upperHeader}>
                    <TouchableOpacity style={styles.roundButton}>
                        <Ionicons name="menu" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.searchStack}>
                        <LocationSearch
                            placeholder="¿Desde dónde?"
                            icon="radio-button-on"
                            iconColor="#00E676"
                            onLocationSelect={(loc) => { setPickup(loc); handleExpand(); }}
                        />
                        <View style={styles.searchDivider} />
                        <LocationSearch
                            placeholder="¿A dónde vamos?"
                            icon="location"
                            iconColor="#FF5252"
                            onLocationSelect={(loc) => { setDestination(loc); handleExpand(); }}
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.addStopButton}>
                    <BlurView intensity={20} tint="dark" style={styles.addStopBlur}>
                        <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                        <Text style={styles.addStopText}>Añadir Parada</Text>
                    </BlurView>
                </TouchableOpacity>
            </SafeAreaView>

            {/* CAPA 1: CONTROLES FLOTANTES REACTIVOS */}
            <Animated.View style={[styles.mapControls, mapControlsStyle]}>
                <TouchableOpacity style={styles.controlButton}>
                    <Ionicons name="add" size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.controlButton, { marginTop: 10 }]}>
                    <Ionicons name="remove" size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.controlButton, { marginTop: 20, backgroundColor: '#FFD600' }]}>
                    <Ionicons name="locate" size={20} color="#000" />
                </TouchableOpacity>
            </Animated.View>

            {/* CAPA 3: BOTTOM SHEET DINÁMICO (PEDIR VIAJE) */}
            <DynamicBottomSheet translateY={panelY}>
                <Text style={styles.sheetTitle}>Propón tu precio</Text>

                <View style={styles.priceInputContainer}>
                    <Text style={styles.currencySymbol}>₡</Text>
                    <TextInput
                        style={styles.priceInput}
                        placeholder="2500"
                        placeholderTextColor="#555"
                        keyboardType="numeric"
                    />
                </View>

                <View style={styles.optionsRow}>
                    <TouchableOpacity style={styles.optionItem}>
                        <Ionicons name="card-outline" size={20} color="#FFF" />
                        <Text style={styles.optionLabel}>Efectivo</Text>
                        <Ionicons name="chevron-down" size={14} color="#888" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.orderButton}>
                    <Text style={styles.orderButtonText}>PEDIR VIAJE NOW</Text>
                </TouchableOpacity>

                {/* CONTENIDO EXTRA PARA TEST SCROLL */}
                <View style={[styles.divider, { marginVertical: 20 }]} />
                <Text style={styles.historyTitle}>Viajes recientes</Text>
                {[1, 2, 3].map((i) => (
                    <TouchableOpacity key={i} style={styles.recentItem}>
                        <Ionicons name="time-outline" size={20} color="#888" />
                        <Text style={styles.recentText}>San José, Costa Rica #{i}</Text>
                    </TouchableOpacity>
                ))}
            </DynamicBottomSheet>
        </View>
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
        zIndex: 100, // Prioridad máxima
    },
    upperHeader: {
        flexDirection: 'row',
        marginTop: Platform.OS === 'android' ? 40 : 10,
    },
    roundButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchStack: {
        flex: 1,
        backgroundColor: '#1A1A1A',
        borderRadius: 15,
        padding: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
        marginTop: 15,
        marginLeft: 58,
    },
    addStopBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    addStopText: {
        color: '#FFF',
        fontSize: 13,
        marginLeft: 6,
        fontWeight: '500',
    },
    mapControls: {
        position: 'absolute',
        right: 15,
        zIndex: 20,
    },
    controlButton: {
        width: 40, // Iconos más pequeños según pedido
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(26,26,26,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sheetTitle: {
        color: '#FFF',
        fontSize: 15,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#888',
        marginBottom: 15,
        textAlign: 'center',
    },
    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    currencySymbol: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginRight: 10,
    },
    priceInput: {
        color: '#FFF',
        fontSize: 48,
        fontWeight: 'bold',
        minWidth: 100,
    },
    optionsRow: {
        flexDirection: 'row',
        marginBottom: 25,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 12,
    },
    optionLabel: {
        color: '#FFF',
        marginHorizontal: 10,
        fontSize: 14,
    },
    orderButton: {
        backgroundColor: '#FFD600',
        height: 60,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFD600',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    orderButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    historyTitle: {
        color: '#888',
        fontSize: 14,
        marginBottom: 15,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    recentText: {
        color: '#FFF',
        marginLeft: 12,
        fontSize: 14,
    }
});

export default MasterRiderDashboard;
