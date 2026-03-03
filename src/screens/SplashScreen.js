import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { COLORS, FONTS, SPACING } from '../theme/colors';
import { scale, moderateScale } from '../theme/responsive';

export default function SplashScreen() {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        // Continuous pulse animation for the logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Pulsing opacity for the text
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0.5,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />

            {/* Background elements */}
            <View style={styles.bgGradient}>
                <View style={styles.bgCircle1} />
                <View style={styles.bgCircle2} />
            </View>

            <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.logoIcon}>🚗</Text>
            </Animated.View>

            <View style={styles.textContainer}>
                <Text
                    style={styles.title}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    ELYSIUM VANGUARD
                </Text>
                <Text
                    style={styles.subtitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    DRIVING
                </Text>

                <Animated.Text style={[styles.loadingText, { opacity: fadeAnim }]}>
                    Inicializando motor...
                </Animated.Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bgGradient: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    bgCircle1: {
        position: 'absolute',
        width: scale(300),
        height: scale(300),
        borderRadius: scale(150),
        backgroundColor: COLORS.neonBlue + '15',
        top: '10%',
        right: '-20%',
    },
    bgCircle2: {
        position: 'absolute',
        width: scale(250),
        height: scale(250),
        borderRadius: scale(125),
        backgroundColor: COLORS.neonPurple + '15',
        bottom: '10%',
        left: '-20%',
    },
    logoContainer: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(40),
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.neonBlue,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: scale(25),
        elevation: 15,
        marginBottom: scale(SPACING.xl),
    },
    logoIcon: {
        fontSize: moderateScale(60),
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: moderateScale(28),
        fontWeight: '900',
        color: COLORS.textPrimary,
        letterSpacing: 3,
    },
    subtitle: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: COLORS.neonBlue,
        letterSpacing: 5,
        marginTop: scale(4),
    },
    loadingText: {
        marginTop: scale(SPACING.xxl),
        color: COLORS.textSecondary,
        fontSize: moderateScale(14),
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
