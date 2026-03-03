import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
    ScrollView, Animated, Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/colors';
import { scale, moderateScale, SAFE_TOP, SAFE_BOTTOM } from '../theme/responsive';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Floating particle component
const FloatingParticle = ({ delay, size, startX, startY, color }) => {
    const anim = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        // Floating movement
        Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 6000 + Math.random() * 4000,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 6000 + Math.random() * 4000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Pulse opacity
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 0.8,
                    duration: 2000 + Math.random() * 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.2,
                    duration: 2000 + Math.random() * 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [startY, startY - 80 - Math.random() * 60],
    });
    const translateX = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [startX, startX + 20, startX - 10],
    });

    return (
        <Animated.View
            style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity: pulse,
                transform: [{ translateX }, { translateY }],
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: size,
            }}
        />
    );
};

export default function LoginScreen({ navigation }) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Animations
    const breatheAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const titleSlide = useRef(new Animated.Value(30)).current;
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const formSlide = useRef(new Animated.Value(50)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;
    const btnScale = useRef(new Animated.Value(0.9)).current;
    const neonRing = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Breathing logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(breatheAnim, {
                    toValue: 1.15,
                    duration: 2500,
                    useNativeDriver: true,
                }),
                Animated.timing(breatheAnim, {
                    toValue: 1,
                    duration: 2500,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Glow pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 3000,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.2,
                    duration: 3000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Neon ring rotation-like pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(neonRing, {
                    toValue: 1,
                    duration: 4000,
                    useNativeDriver: true,
                }),
                Animated.timing(neonRing, {
                    toValue: 0,
                    duration: 4000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Entrance animations
        Animated.stagger(200, [
            Animated.parallel([
                Animated.timing(titleSlide, { toValue: 0, duration: 800, useNativeDriver: true }),
                Animated.timing(titleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(formSlide, { toValue: 0, duration: 700, useNativeDriver: true }),
                Animated.timing(formOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
            ]),
            Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        setLoading(true);
        try {
            await login(email.trim(), password);
        } catch (error) {
            let msg = 'Error al iniciar sesión';
            if (error.code === 'auth/invalid-email') msg = 'Email inválido';
            else if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
            else if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado';
            Alert.alert('Error', msg);
        }
        setLoading(false);
    };

    const neonRingScale = neonRing.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.3],
    });
    const neonRingOpacity = neonRing.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.6, 0.15, 0.6],
    });

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="light-content" />

            {/* Animated background particles */}
            <View style={styles.bgGradient}>
                <Animated.View style={[styles.bgCircle1, { opacity: glowAnim }]} />
                <Animated.View style={[styles.bgCircle2, { opacity: glowAnim }]} />
                <Animated.View style={[styles.bgCircle3, {
                    opacity: glowAnim,
                    transform: [{ scale: breatheAnim }]
                }]} />

                {/* Floating neon particles */}
                <FloatingParticle delay={0} size={6} startX={40} startY={SCREEN_H * 0.3} color={COLORS.neonBlue} />
                <FloatingParticle delay={800} size={4} startX={SCREEN_W * 0.7} startY={SCREEN_H * 0.5} color={COLORS.neonPurple} />
                <FloatingParticle delay={400} size={5} startX={SCREEN_W * 0.4} startY={SCREEN_H * 0.7} color={COLORS.neonGreen} />
                <FloatingParticle delay={1200} size={3} startX={SCREEN_W * 0.2} startY={SCREEN_H * 0.6} color={COLORS.neonBlue} />
                <FloatingParticle delay={600} size={7} startX={SCREEN_W * 0.8} startY={SCREEN_H * 0.2} color={COLORS.neonPurple} />
                <FloatingParticle delay={1500} size={4} startX={SCREEN_W * 0.5} startY={SCREEN_H * 0.4} color={COLORS.neonPink} />
                <FloatingParticle delay={300} size={5} startX={SCREEN_W * 0.1} startY={SCREEN_H * 0.8} color={COLORS.neonGreen} />
                <FloatingParticle delay={900} size={3} startX={SCREEN_W * 0.6} startY={SCREEN_H * 0.15} color={COLORS.neonBlue} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Back button */}
                <TouchableOpacity
                    style={[styles.backBtn, { top: SAFE_TOP }]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backBtnText}>← Volver</Text>
                </TouchableOpacity>

                {/* Header with breathing logo */}
                <Animated.View style={[styles.header, {
                    opacity: titleOpacity,
                    transform: [{ translateY: titleSlide }]
                }]}>
                    <View style={styles.logoWrapper}>
                        {/* Neon ring behind logo */}
                        <Animated.View style={[styles.neonRingOuter, {
                            opacity: neonRingOpacity,
                            transform: [{ scale: neonRingScale }],
                        }]} />
                        <Animated.View style={[styles.logoContainer, { transform: [{ scale: breatheAnim }] }]}>
                            <Text style={styles.logoIcon}>🚀</Text>
                            <Animated.View style={[styles.logoGlow, { opacity: glowAnim }]} />
                        </Animated.View>
                    </View>
                    <Text style={styles.title}>Elysium Vanguard</Text>
                    <Text style={styles.subtitle}>Driving</Text>
                    <View style={styles.tagLine}>
                        <View style={styles.tagDot} />
                        <Text style={styles.tagText}>CONECTADO • SEGURO • RÁPIDO</Text>
                        <View style={styles.tagDot} />
                    </View>
                </Animated.View>

                {/* Form */}
                <Animated.View style={[styles.form, {
                    opacity: formOpacity,
                    transform: [{ translateY: formSlide }]
                }]}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Correo electrónico</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputIcon}>✉️</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="tu@email.com"
                                placeholderTextColor={COLORS.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Contraseña</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputIcon}>🔒</Text>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Tu contraseña"
                                placeholderTextColor={COLORS.textMuted}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                            >
                                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                        <TouchableOpacity
                            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.loginBtnText}>⚡ Iniciar Sesión</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    <TouchableOpacity
                        style={styles.registerLink}
                        onPress={() => navigation.navigate('Register')}
                    >
                        <Text style={styles.registerLinkText}>
                            ¿No tienes cuenta? <Text style={styles.registerLinkAccent}>Regístrate</Text>
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Version footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Elysium Vanguard Driving v2.0 • Costa Rica 🇨🇷</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
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
        zIndex: -1,
    },
    bgCircle1: {
        position: 'absolute',
        width: scale(350),
        height: scale(350),
        borderRadius: scale(175),
        backgroundColor: COLORS.neonBlue + '12',
        top: scale(-80),
        right: scale(-80),
    },
    bgCircle2: {
        position: 'absolute',
        width: scale(280),
        height: scale(280),
        borderRadius: scale(140),
        backgroundColor: COLORS.neonPurple + '10',
        bottom: scale(80),
        left: scale(-80),
    },
    bgCircle3: {
        position: 'absolute',
        width: scale(200),
        height: scale(200),
        borderRadius: scale(100),
        backgroundColor: COLORS.neonGreen + '08',
        top: SCREEN_H * 0.4,
        right: scale(-40),
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: scale(SPACING.lg),
        paddingTop: SAFE_TOP + scale(40),
        paddingBottom: SAFE_BOTTOM + scale(SPACING.xl),
        justifyContent: 'center',
    },
    backBtn: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    backBtnText: {
        color: COLORS.textSecondary,
        fontSize: moderateScale(FONTS.sizes.md),
        fontWeight: '600',
    },
    header: {
        alignItems: 'center',
        marginBottom: scale(SPACING.xl),
    },
    logoWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(SPACING.md),
    },
    neonRingOuter: {
        position: 'absolute',
        width: scale(140),
        height: scale(140),
        borderRadius: scale(70),
        borderWidth: 2,
        borderColor: COLORS.neonBlue,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: scale(20),
    },
    logoContainer: {
        width: scale(100),
        height: scale(100),
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoGlow: {
        position: 'absolute',
        width: scale(130),
        height: scale(130),
        borderRadius: scale(65),
        backgroundColor: COLORS.neonBlue + '25',
        zIndex: -1,
    },
    logoIcon: {
        fontSize: moderateScale(60),
        textShadowColor: COLORS.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: scale(25),
    },
    title: {
        fontSize: moderateScale(36),
        fontWeight: '950',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 6,
        textShadowColor: COLORS.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: scale(20),
    },
    subtitle: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.neonBlue,
        marginTop: scale(SPACING.xs),
        fontWeight: '800',
        letterSpacing: 4,
        textTransform: 'uppercase',
    },
    tagLine: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(SPACING.sm),
        gap: scale(8),
    },
    tagDot: {
        width: scale(4),
        height: scale(4),
        borderRadius: scale(2),
        backgroundColor: COLORS.neonPurple,
        shadowColor: COLORS.neonPurple,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: scale(5),
    },
    tagText: {
        fontSize: moderateScale(9),
        color: COLORS.textMuted,
        letterSpacing: 3,
        fontWeight: '700',
    },
    form: {
        gap: scale(SPACING.md),
        backgroundColor: COLORS.glassBgDark,
        padding: scale(SPACING.lg),
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: scale(20),
    },
    inputGroup: {
        gap: scale(SPACING.xs),
    },
    label: {
        fontSize: moderateScale(10),
        fontWeight: '900',
        color: COLORS.textSecondary,
        marginLeft: scale(SPACING.xs),
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        paddingHorizontal: scale(SPACING.sm),
    },
    inputIcon: {
        fontSize: moderateScale(16),
        marginRight: scale(8),
    },
    input: {
        flex: 1,
        paddingVertical: scale(14),
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textPrimary,
    },
    eyeBtn: {
        padding: scale(8),
    },
    eyeIcon: {
        fontSize: moderateScale(18),
    },
    loginBtn: {
        backgroundColor: COLORS.neonBlue,
        borderRadius: RADIUS.full,
        paddingVertical: scale(16),
        alignItems: 'center',
        marginTop: scale(SPACING.md),
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: scale(20),
        elevation: 12,
    },
    loginBtnDisabled: {
        opacity: 0.5,
    },
    loginBtnText: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '900',
        color: '#000',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    registerLink: {
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    registerLinkText: {
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textSecondary,
    },
    registerLinkAccent: {
        color: COLORS.neonBlue,
        fontWeight: '900',
        textShadowColor: COLORS.neonBlue + '80',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    footer: {
        alignItems: 'center',
        marginTop: scale(SPACING.xl),
    },
    footerText: {
        fontSize: moderateScale(10),
        color: COLORS.textMuted,
        letterSpacing: 2,
    },
});
