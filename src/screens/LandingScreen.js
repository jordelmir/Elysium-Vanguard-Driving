import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar,
    Dimensions, ImageBackground,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Animated background gradient effect */}
            <View style={styles.bgGradient}>
                <View style={styles.bgCircle1} />
                <View style={styles.bgCircle2} />
                <View style={styles.bgCircle3} />
            </View>

            <View style={styles.content}>
                {/* Logo & Branding */}
                <View style={styles.logoSection}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoIcon}>🚗</Text>
                    </View>
                    <Text style={styles.title}>Elysium Vanguard{"\n"}Driving</Text>
                    <Text style={styles.subtitle}>Tu transporte premium, seguro y económico</Text>
                </View>

                {/* Features */}
                <View style={styles.features}>
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
                </View>

                {/* CTA Buttons */}
                <View style={styles.ctaSection}>
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
                </View>

                <Text style={styles.footer}>
                    Pagos en efectivo y SINPE 🇨🇷
                </Text>
            </View>
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
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: COLORS.accentGlow,
        top: -80,
        right: -60,
        opacity: 0.4,
    },
    bgCircle2: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(88, 166, 255, 0.1)',
        bottom: 100,
        left: -40,
    },
    bgCircle3: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: COLORS.accentGlow,
        bottom: -30,
        right: 50,
        opacity: 0.2,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: SPACING.lg,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 30,
        backgroundColor: COLORS.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: SPACING.md,
    },
    logoIcon: {
        fontSize: 50,
    },
    appName: {
        fontSize: FONTS.sizes.hero,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: 1,
    },
    tagline: {
        fontSize: FONTS.sizes.lg,
        color: COLORS.accent,
        fontWeight: '500',
        marginTop: SPACING.xs,
    },
    features: {
        marginBottom: SPACING.xxl,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    featureIcon: {
        fontSize: 28,
        marginRight: SPACING.md,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    featureDesc: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    ctaSection: {
        gap: SPACING.sm,
    },
    primaryBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.xl,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryBtnText: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: '#ffffff',
    },
    secondaryBtn: {
        backgroundColor: 'transparent',
        borderRadius: RADIUS.xl,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    secondaryBtnText: {
        fontSize: FONTS.sizes.md,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    footer: {
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.sm,
        marginTop: SPACING.lg,
    },
});
