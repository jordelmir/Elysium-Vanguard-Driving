import React, { useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar,
    Dimensions, ImageBackground, Animated,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/colors';
import { scale, moderateScale, SAFE_TOP, SAFE_BOTTOM } from '../theme/responsive';

const { width, height } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Slide up animations for staggered appearance
    const slideLogo = useRef(new Animated.Value(50)).current;
    const slideFeatures = useRef(new Animated.Value(50)).current;
    const slideButtons = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        // Initial entrance sequence
        Animated.sequence([
            // 1. Logo fades and slides up
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(slideLogo, { toValue: 0, duration: 800, useNativeDriver: true }),
            ]),
            // 2. Features slide up
            Animated.timing(slideFeatures, { toValue: 0, duration: 600, useNativeDriver: true }),
            // 3. CTA Buttons slide up
            Animated.timing(slideButtons, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();

        // Continuous pulse animation for logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.08,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />

            <View style={styles.bgGradient}>
                <View style={styles.bgCircle1} />
                <View style={styles.bgCircle2} />
                <View style={styles.bgCircle3} />
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    {/* Logo & Branding */}
                    <Animated.View style={[styles.logoSection, { opacity: fadeAnim, transform: [{ translateY: slideLogo }] }]}>
                        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
                            <Text style={styles.logoIcon}>🚗</Text>
                        </Animated.View>
                        <Text
                            style={styles.title}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            Elysium Vanguard
                        </Text>
                        <Text
                            style={styles.subtitle}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            Driving
                        </Text>
                    </Animated.View>

                    {/* Features */}
                    <Animated.View style={[styles.features, { opacity: fadeAnim, transform: [{ translateY: slideFeatures }] }]}>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureTitle}>¿Qué es Elysium Vanguard Driving?</Text>
                            <Text style={styles.featureDesc}>
                                Somos la alternativa justa. Tú propones el precio, nosotros te conectamos con los mejores choferes.
                            </Text>
                        </View>

                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>📍</Text>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>GPS en tiempo real</Text>
                                <Text style={styles.featureDesc}>Rastrea tu viaje al instante</Text>
                            </View>
                        </View>

                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>🤝</Text>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>Tú decides el precio</Text>
                                <Text style={styles.featureDesc}>Propone y negocia directamente</Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* CTA Buttons */}
                    <Animated.View style={[styles.ctaSection, { opacity: fadeAnim, transform: [{ translateY: slideButtons }] }]}>
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => navigation.navigate('Register')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.primaryBtnText}>Comenzar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => navigation.navigate('Login')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.secondaryBtnText}>Ya tengo cuenta</Text>
                        </TouchableOpacity>

                        <Text style={styles.footer}>
                            Pagos en efectivo y SINPE 🇨🇷
                        </Text>
                    </Animated.View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
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
        backgroundColor: COLORS.neonBlue + '22',
        top: scale(-80),
        right: scale(-60),
    },
    bgCircle2: {
        position: 'absolute',
        width: scale(200),
        height: scale(200),
        borderRadius: scale(100),
        backgroundColor: COLORS.neonPurple + '11',
        bottom: scale(100),
        left: scale(-40),
    },
    bgCircle3: {
        position: 'absolute',
        width: scale(150),
        height: scale(150),
        borderRadius: scale(75),
        backgroundColor: COLORS.neonBlue + '11',
        bottom: scale(-30),
        right: scale(50),
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: scale(SPACING.lg),
        paddingTop: SAFE_TOP + scale(SPACING.md),
        paddingBottom: SAFE_BOTTOM + scale(SPACING.md),
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: scale(SPACING.xxl),
    },
    logoContainer: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(35),
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.neonBlue,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: scale(15),
        elevation: 15,
        marginBottom: scale(SPACING.md),
    },
    logoIcon: {
        fontSize: moderateScale(50),
    },
    title: {
        fontSize: moderateScale(32),
        fontWeight: '900',
        color: COLORS.textPrimary,
        textAlign: 'center',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    subtitle: {
        fontSize: moderateScale(18),
        color: COLORS.neonBlue,
        fontWeight: 'bold',
        marginTop: scale(5),
        letterSpacing: 2,
    },
    features: {
        marginBottom: scale(SPACING.xxl),
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glassBg,
        borderRadius: RADIUS.lg,
        padding: scale(SPACING.md),
        marginBottom: scale(SPACING.sm),
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    featureIcon: {
        fontSize: moderateScale(28),
        marginRight: scale(SPACING.md),
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    featureDesc: {
        fontSize: moderateScale(14),
        color: COLORS.textSecondary,
        marginTop: scale(2),
    },
    ctaSection: {
        gap: scale(SPACING.md),
    },
    primaryBtn: {
        backgroundColor: COLORS.neonBlue,
        borderRadius: RADIUS.xl,
        paddingVertical: scale(18),
        alignItems: 'center',
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: scale(10),
        elevation: 8,
    },
    primaryBtnText: {
        fontSize: moderateScale(18),
        fontWeight: '900',
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    secondaryBtn: {
        backgroundColor: 'transparent',
        borderRadius: RADIUS.xl,
        paddingVertical: scale(18),
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.neonPurple,
        shadowColor: COLORS.neonPurple,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: scale(5),
    },
    secondaryBtnText: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: COLORS.neonPurple,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    footer: {
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: moderateScale(12),
        marginTop: scale(SPACING.lg),
        fontWeight: 'bold',
    },
});
