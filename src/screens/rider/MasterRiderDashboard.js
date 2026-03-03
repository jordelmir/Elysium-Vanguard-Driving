import React, { useState } from 'react';
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
    TouchableWithoutFeedback,
    Keyboard,
    TextInput
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

// Componentes refactorizados
import LocationSearch from '../../components/LocationSearch';
import DynamicBottomSheet from '../../components/DynamicBottomSheet';

const { height, width } = Dimensions.get('window');

const MasterRiderDashboard = () => {
    // ESTADOS DE UI - panelY ahora es la posición absoluta desde el fondo
    const panelY = useSharedValue(height * 0.7);

    // ESTADOS DE UBICACIÓN
    const [pickup, setPickup] = useState(null);
    const [destination, setDestination] = useState(null);

    // ESTILOS ANIMADOS REACTIVOS (Capa 1: Controles del mapa)
    // Los botones de Zoom deben reaccionar al Bottom Sheet para no ser cubiertos
    const mapControlsStyle = useAnimatedStyle(() => {
        const bottomOffset = interpolate(
            panelY.value,
            [height * 0.5, height * 0.7],
            [height * 0.55, height * 0.35], // Sube cuando el panel sube
            'clamp'
        );
        return {
            bottom: bottomOffset,
        };
    });

    const handleExpand = () => {
        panelY.value = withSpring(height * 0.5, { damping: 15 });
    };

    const handleCollapse = () => {
        panelY.value = withSpring(height * 0.7, { damping: 15 });
    };

    return (
                    </TouchableOpacity >
                ))}
            </DynamicBottomSheet >
        </KeyboardAvoidingView >
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
