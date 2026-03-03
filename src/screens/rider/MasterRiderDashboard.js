import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Dimensions,
    TouchableOpacity,
    TextInput,
    Platform
} from 'react-native';
import { LeafletView } from 'react-native-leaflet-view';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { height, width } = Dimensions.get('window');

const MasterRiderDashboard = () => {
    const [pickup, setPickup] = useState('');
    const [destination, setDestination] = useState('');

    // Animación para el panel inferior (Glassmorphism)
    const panelY = useSharedValue(height * 0.7);

    const panelAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: panelY.value }],
        };
    });

    const handleExpand = () => {
        panelY.value = withSpring(height * 0.35, { damping: 15 });
    };

    const handleCollapse = () => {
        panelY.value = withSpring(height * 0.7, { damping: 15 });
    };

    return (
        <View style={styles.container}>
            {/* MOTOR DE MAPA (Leaflet con capa de diseño oscuro masterizada) */}
            <View style={styles.mapContainer}>
                <LeafletView
                    mapLayers={[
                        {
                            baseLayerName: 'CartoDB DarkMatter',
                            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                            attribution: '&copy; OpenStreetMap contributors'
                        }
                    ]}
                    zoom={15}
                    onMessageReceived={(message) => {
                        if (message.event === 'onMapClicked') handleCollapse();
                    }}
                />
            </View>

            {/* HEADER MINIMALISTA */}
            <View style={styles.header}>
                <BlurView intensity={30} tint="dark" style={styles.menuButton}>
                    <Ionicons name="menu" size={28} color="#FFF" />
                </BlurView>
            </View>

            {/* PANEL INFERIOR - MASTER UI (Glassmorphism + Reanimated) */}
            <Animated.View style={[styles.bottomPanel, panelAnimatedStyle]}>
                <BlurView intensity={80} tint="dark" style={styles.glassContainer}>
                    <View style={styles.dragHandle} />

                    <Text style={styles.welcomeText}>¿A dónde vamos hoy?</Text>

                    <View style={styles.inputWrapper}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="radio-button-on" size={18} color="#00E676" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Punto de recogida"
                                placeholderTextColor="#888"
                                value={pickup}
                                onChangeText={setPickup}
                                onFocus={handleExpand}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.inputContainer}>
                            <Ionicons name="location" size={18} color="#FF5252" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Destino final"
                                placeholderTextColor="#888"
                                value={destination}
                                onChangeText={setDestination}
                                onFocus={handleExpand}
                            />
                        </View>
                    </View>

                    {/* ATAJOS RAPIDOS */}
                    <View style={styles.shortcuts}>
                        <TouchableOpacity style={styles.shortcutItem}>
                            <Ionicons name="home" size={20} color="#FFF" />
                            <Text style={styles.shortcutText}>Casa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.shortcutItem}>
                            <Ionicons name="briefcase" size={20} color="#FFF" />
                            <Text style={styles.shortcutText}>Trabajo</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </Animated.View>
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
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
    },
    menuButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bottomPanel: {
        position: 'absolute',
        width: width,
        height: height,
        zIndex: 20,
    },
    glassContainer: {
        flex: 1,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    welcomeText: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    inputWrapper: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 55,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 15,
    },
    shortcuts: {
        flexDirection: 'row',
        marginTop: 25,
    },
    shortcutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
    },
    shortcutText: {
        color: '#FFF',
        marginLeft: 8,
        fontSize: 14,
    }
});

export default MasterRiderDashboard;
