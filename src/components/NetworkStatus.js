import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING } from '../theme/colors';
import { moderateScale, scale, SAFE_TOP } from '../theme/responsive';

const NetworkStatus = () => {
    const [isOffline, setIsOffline] = useState(false);
    const slideAnim = React.useRef(new Animated.Value(-100)).current;

    const checkConnection = async () => {
        try {
            // Ping a reliable endpoint
            const response = await fetch('https://www.google.com/generate_204', {
                method: 'HEAD',
                cache: 'no-store',
            });
            if (response.ok && isOffline) {
                setIsOffline(false);
            }
        } catch (error) {
            if (!isOffline) {
                setIsOffline(true);
            }
        }
    };

    useEffect(() => {
        const interval = setInterval(checkConnection, 10000); // Check every 10s
        checkConnection(); // Initial check
        return () => clearInterval(interval);
    }, [isOffline]);

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isOffline ? 0 : -100,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isOffline]);

    if (!isOffline) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.text}>⚠️ Sin conexión a Internet</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.error,
        paddingTop: SAFE_TOP + scale(SPACING.xs),
        paddingBottom: scale(SPACING.xs),
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: moderateScale(14),
    },
});

export default NetworkStatus;
