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

// Floating particle
const FloatingParticle = ({ delay, size, startX, startY, color }) => {
    const anim = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, { toValue: 1, duration: 6000 + Math.random() * 4000, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0, duration: 6000 + Math.random() * 4000, useNativeDriver: true }),
            ])
        ).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.8, duration: 2000 + Math.random() * 2000, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.2, duration: 2000 + Math.random() * 2000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [startY, startY - 60 - Math.random() * 50] });
    const translateX = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [startX, startX + 15, startX - 10] });

    return (
        <Animated.View
            style={{
                position: 'absolute', width: size, height: size, borderRadius: size / 2,
                backgroundColor: color, opacity: pulse,
                transform: [{ translateX }, { translateY }],
                shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: size,
            }}
        />
    );
};

export default function RegisterScreen({ navigation }) {
    const { register } = useAuth();
    const [step, setStep] = useState(1);
    const [role, setRole] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [vehicleMake, setVehicleMake] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [loading, setLoading] = useState(false);

    // Animations
    const breatheAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const contentSlide = useRef(new Animated.Value(40)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const stepPulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Breathing
        Animated.loop(
            Animated.sequence([
                Animated.timing(breatheAnim, { toValue: 1.08, duration: 3000, useNativeDriver: true }),
                Animated.timing(breatheAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
            ])
        ).start();

        // Glow
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
                Animated.timing(glowAnim, { toValue: 0.3, duration: 4000, useNativeDriver: true }),
            ])
        ).start();

        // Entrance
        Animated.parallel([
            Animated.timing(contentSlide, { toValue: 0, duration: 700, useNativeDriver: true }),
            Animated.timing(contentOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]).start();
    }, []);

    // Pulse on step change
    useEffect(() => {
        Animated.sequence([
            Animated.timing(stepPulse, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.spring(stepPulse, { toValue: 1, friction: 3, useNativeDriver: true }),
        ]).start();
    }, [step]);

    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !phone.trim() || !password) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Error', 'Por favor ingresa un email válido');
            return;
        }

        // Phone validation (Costa Rica: 8 digits)
        const phoneClean = phone.replace(/[\s\-\(\)]/g, '');
        if (phoneClean.length < 8) {
            Alert.alert('Error', 'El número de teléfono debe tener al menos 8 dígitos');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        // Driver vehicle validation
        if (role === 'driver') {
            if (!vehicleMake.trim() || !vehicleModel.trim() || !vehiclePlate.trim() || !vehicleColor.trim()) {
                Alert.alert('Error', 'Por favor completa toda la información del vehículo');
                return;
            }
        }

        setLoading(true);
        try {
            const vehicleInfo = role === 'driver' ? {
                make: vehicleMake.trim(),
                model: vehicleModel.trim(),
                plate: vehiclePlate.trim().toUpperCase(),
                color: vehicleColor.trim(),
            } : null;

            // Register immediately links data to account in AuthContext
            await register(
                email.trim(),
                password,
                name.trim(),
                phone.trim(),
                role,
                vehicleInfo
            );

            // AuthContext handles state transition, so we don't need manual navigation
        } catch (error) {
            let msg = 'Error al registrarse';
            if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está en uso';
            else if (error.code === 'auth/invalid-email') msg = 'Email inválido';
            else if (error.code === 'auth/weak-password') msg = 'La contraseña es muy débil';
            Alert.alert('Error', msg);
        }
        setLoading(false);
    };

    const StepIndicator = () => (
        <View style={styles.stepIndicator}>
            {[1, 2, 3].map(s => (
                <View key={s} style={[
                    styles.stepDot,
                    s === step && styles.stepDotActive,
                    s < step && styles.stepDotDone,
                    (s === 3 && role !== 'driver') && { display: 'none' },
                ]}>
                    {s < step ? (
                        <Text style={styles.stepDotCheck}>✓</Text>
                    ) : (
                        <Text style={[styles.stepDotText, s === step && styles.stepDotTextActive]}>{s}</Text>
                    )}
                </View>
            ))}
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="light-content" />

            {/* Animated background */}
            <View style={styles.bgGradient}>
                <Animated.View style={[styles.bgCircle1, { opacity: glowAnim }]} />
                <Animated.View style={[styles.bgCircle2, { opacity: glowAnim }]} />

                <FloatingParticle delay={0} size={5} startX={30} startY={SCREEN_H * 0.2} color={COLORS.neonBlue} />
                <FloatingParticle delay={600} size={4} startX={SCREEN_W * 0.8} startY={SCREEN_H * 0.4} color={COLORS.neonPurple} />
                <FloatingParticle delay={1200} size={6} startX={SCREEN_W * 0.5} startY={SCREEN_H * 0.6} color={COLORS.neonGreen} />
                <FloatingParticle delay={300} size={3} startX={SCREEN_W * 0.3} startY={SCREEN_H * 0.8} color={COLORS.neonBlue} />
                <FloatingParticle delay={900} size={5} startX={SCREEN_W * 0.7} startY={SCREEN_H * 0.15} color={COLORS.neonPink} />
                <FloatingParticle delay={1500} size={4} startX={SCREEN_W * 0.1} startY={SCREEN_H * 0.5} color={COLORS.neonPurple} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Back button */}
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
                >
                    <Text style={styles.backBtnText}>← {step > 1 ? 'Anterior' : 'Volver'}</Text>
                </TouchableOpacity>

                <StepIndicator />

                {/* Step 1: Role Selection */}
                {step === 1 && (
                    <Animated.View style={[styles.stepContainer, {
                        opacity: contentOpacity,
                        transform: [{ translateY: contentSlide }, { scale: stepPulse }]
                    }]}>
                        <Animated.Text style={[styles.title, { transform: [{ scale: breatheAnim }] }]}>
                            ¿Cómo usarás Elysium Vanguard?
                        </Animated.Text>
                        <Text style={styles.subtitle}>Selecciona tu rol para comenzar</Text>

                        <TouchableOpacity
                            style={[styles.roleCard, role === 'rider' && styles.roleCardActive]}
                            onPress={() => { setRole('rider'); setStep(2); }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.roleIconBox}>
                                <Text style={styles.roleIcon}>🧑</Text>
                            </View>
                            <View style={styles.roleInfo}>
                                <Text style={styles.roleTitle}>Pasajero</Text>
                                <Text style={styles.roleDesc}>Solicitar viajes y proponer tu precio</Text>
                            </View>
                            <Text style={styles.roleArrow}>→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.roleCard, role === 'driver' && styles.roleCardActive]}
                            onPress={() => { setRole('driver'); setStep(2); }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.roleIconBox}>
                                <Text style={styles.roleIcon}>🚗</Text>
                            </View>
                            <View style={styles.roleInfo}>
                                <Text style={styles.roleTitle}>Chofer</Text>
                                <Text style={styles.roleDesc}>Acepta viajes y gana con solo 1% de comisión</Text>
                            </View>
                            <Text style={styles.roleArrow}>→</Text>
                        </TouchableOpacity>

                        <View style={styles.commissionBadge}>
                            <Text style={styles.commissionText}>⚡ Comisión Elysium Vanguard: solo 1%</Text>
                            <Text style={styles.commissionSub}>La opción más justa del mercado</Text>
                        </View>
                    </Animated.View>
                )}

                {/* Step 2: Personal Info */}
                {step === 2 && (
                    <Animated.View style={[styles.stepContainer, { transform: [{ scale: stepPulse }] }]}>
                        <Text style={styles.title}>
                            {role === 'driver' ? '¡Bienvenido, chofer!' : '¡Bienvenido!'}
                        </Text>
                        <Text style={styles.subtitle}>Completa tu información</Text>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre completo</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>👤</Text>
                                    <TextInput style={styles.input} value={name} onChangeText={setName}
                                        placeholder="Tu nombre" placeholderTextColor={COLORS.textMuted} />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Correo electrónico</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>✉️</Text>
                                    <TextInput style={styles.input} value={email} onChangeText={setEmail}
                                        placeholder="tu@email.com" placeholderTextColor={COLORS.textMuted}
                                        keyboardType="email-address" autoCapitalize="none" />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Teléfono</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>📱</Text>
                                    <TextInput style={styles.input} value={phone} onChangeText={setPhone}
                                        placeholder="+506 8888-8888" placeholderTextColor={COLORS.textMuted}
                                        keyboardType="phone-pad" />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Contraseña</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>🔒</Text>
                                    <TextInput style={styles.input} value={password} onChangeText={setPassword}
                                        placeholder="Mínimo 6 caracteres" placeholderTextColor={COLORS.textMuted}
                                        secureTextEntry={!showPassword} />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeBtn}
                                    >
                                        <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {role === 'driver' ? (
                                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(3)} activeOpacity={0.8}>
                                    <Text style={styles.primaryBtnText}>Siguiente: Vehículo →</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                    onPress={handleRegister} disabled={loading} activeOpacity={0.8}
                                >
                                    {loading ? <ActivityIndicator color="#000" /> :
                                        <Text style={styles.primaryBtnText}>⚡ Crear Cuenta</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>
                )}

                {/* Step 3: Vehicle Info */}
                {step === 3 && (
                    <Animated.View style={[styles.stepContainer, { transform: [{ scale: stepPulse }] }]}>
                        <Text style={styles.title}>Tu vehículo</Text>
                        <Text style={styles.subtitle}>Información de tu carro</Text>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Marca</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>🏭</Text>
                                    <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake}
                                        placeholder="Ej: Toyota" placeholderTextColor={COLORS.textMuted} />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Modelo</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>🚗</Text>
                                    <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel}
                                        placeholder="Ej: Corolla 2020" placeholderTextColor={COLORS.textMuted} />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Placa</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>🔢</Text>
                                    <TextInput style={styles.input} value={vehiclePlate} onChangeText={setVehiclePlate}
                                        placeholder="Ej: ABC-123" placeholderTextColor={COLORS.textMuted}
                                        autoCapitalize="characters" />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Color</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputIcon}>🎨</Text>
                                    <TextInput style={styles.input} value={vehicleColor} onChangeText={setVehicleColor}
                                        placeholder="Ej: Blanco" placeholderTextColor={COLORS.textMuted} />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                onPress={handleRegister} disabled={loading} activeOpacity={0.8}
                            >
                                {loading ? <ActivityIndicator color="#000" /> :
                                    <Text style={styles.primaryBtnText}>⚡ Crear Cuenta de Chofer</Text>}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}

                {/* Login link */}
                <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.loginLinkText}>
                        ¿Ya tienes cuenta? <Text style={styles.loginLinkAccent}>Inicia sesión</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgPrimary },
    bgGradient: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: -1 },
    bgCircle1: {
        position: 'absolute', width: scale(300), height: scale(300), borderRadius: scale(150),
        backgroundColor: COLORS.neonBlue + '12', top: scale(-60), right: scale(-60),
    },
    bgCircle2: {
        position: 'absolute', width: scale(250), height: scale(250), borderRadius: scale(125),
        backgroundColor: COLORS.neonPurple + '10', bottom: scale(60), left: scale(-60),
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: scale(SPACING.lg),
        paddingTop: SAFE_TOP + scale(40),
        paddingBottom: SAFE_BOTTOM + scale(SPACING.xl),
        justifyContent: 'center',
    },
    backBtn: { position: 'absolute', top: 0, left: scale(SPACING.lg), zIndex: 10, paddingVertical: scale(SPACING.sm) },
    backBtnText: { color: COLORS.textSecondary, fontSize: moderateScale(FONTS.sizes.md), fontWeight: '600' },

    // Step indicator
    stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: scale(12), marginBottom: scale(SPACING.lg) },
    stepDot: {
        width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: COLORS.bgCard,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border,
    },
    stepDotActive: {
        borderColor: COLORS.neonBlue, backgroundColor: COLORS.neonBlue + '22',
        shadowColor: COLORS.neonBlue, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8, shadowRadius: scale(8),
    },
    stepDotDone: { borderColor: COLORS.neonGreen, backgroundColor: COLORS.neonGreen + '22' },
    stepDotText: { fontSize: moderateScale(12), fontWeight: '800', color: COLORS.textMuted },
    stepDotTextActive: { color: COLORS.neonBlue },
    stepDotCheck: { fontSize: moderateScale(14), color: COLORS.neonGreen, fontWeight: '900' },

    stepContainer: { flex: 1 },
    title: {
        fontSize: moderateScale(26), fontWeight: '900', color: COLORS.textPrimary, marginBottom: scale(SPACING.xs),
        textTransform: 'uppercase', letterSpacing: 1,
        textShadowColor: COLORS.neonBlue, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: scale(10),
    },
    subtitle: { fontSize: moderateScale(FONTS.sizes.sm), color: COLORS.neonBlue, marginBottom: scale(SPACING.lg), fontWeight: '700', letterSpacing: 1 },

    // Role cards
    roleCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glassBgDark,
        borderRadius: RADIUS.lg, padding: scale(SPACING.lg), marginBottom: scale(SPACING.md),
        borderWidth: 1, borderColor: COLORS.glassBorder,
    },
    roleCardActive: {
        borderColor: COLORS.neonBlue, backgroundColor: COLORS.neonBlue + '10',
        shadowColor: COLORS.neonBlue, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10,
    },
    roleIconBox: {
        width: scale(50), height: scale(50), borderRadius: scale(25), backgroundColor: COLORS.bgCard,
        justifyContent: 'center', alignItems: 'center', marginRight: scale(SPACING.md),
        borderWidth: 1, borderColor: COLORS.border,
    },
    roleIcon: { fontSize: moderateScale(28) },
    roleInfo: { flex: 1 },
    roleTitle: { fontSize: moderateScale(FONTS.sizes.lg), fontWeight: '800', color: COLORS.textPrimary, textTransform: 'uppercase' },
    roleDesc: { fontSize: moderateScale(FONTS.sizes.xs), color: COLORS.textSecondary, marginTop: scale(4) },
    roleArrow: { fontSize: moderateScale(20), color: COLORS.neonBlue, fontWeight: '900' },

    commissionBadge: {
        backgroundColor: 'rgba(57, 255, 20, 0.05)', borderRadius: RADIUS.md, padding: scale(SPACING.md),
        alignItems: 'center', marginTop: scale(SPACING.md), borderWidth: 1, borderColor: COLORS.neonGreen + '30',
    },
    commissionText: { fontSize: moderateScale(FONTS.sizes.md), fontWeight: '800', color: COLORS.neonGreen, textTransform: 'uppercase' },
    commissionSub: { fontSize: moderateScale(10), color: COLORS.textSecondary, marginTop: scale(2), fontWeight: '600' },

    // Form
    form: {
        gap: scale(SPACING.md), backgroundColor: COLORS.glassBgDark, padding: scale(SPACING.lg),
        borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.glassBorder,
        shadowColor: COLORS.neonBlue, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: scale(15),
    },
    inputGroup: { gap: scale(SPACING.xs) },
    label: {
        fontSize: moderateScale(10), fontWeight: '900', color: COLORS.textSecondary, marginLeft: scale(SPACING.xs),
        textTransform: 'uppercase', letterSpacing: 2,
    },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: scale(SPACING.sm),
    },
    inputIcon: { fontSize: moderateScale(16), marginRight: scale(8) },
    input: { flex: 1, paddingVertical: scale(14), fontSize: moderateScale(FONTS.sizes.md), color: COLORS.textPrimary },
    eyeBtn: { padding: scale(8) },
    eyeIcon: { fontSize: moderateScale(18) },

    primaryBtn: {
        backgroundColor: COLORS.neonBlue, borderRadius: RADIUS.full, paddingVertical: scale(16),
        alignItems: 'center', marginTop: scale(SPACING.md),
        shadowColor: COLORS.neonBlue, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9,
        shadowRadius: scale(15), elevation: 12,
    },
    btnDisabled: { opacity: 0.5 },
    primaryBtnText: { fontSize: moderateScale(FONTS.sizes.lg), fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1 },

    loginLink: { alignItems: 'center', marginTop: scale(SPACING.md) },
    loginLinkText: { fontSize: moderateScale(FONTS.sizes.md), color: COLORS.textSecondary },
    loginLinkAccent: {
        color: COLORS.neonBlue, fontWeight: '900',
        textShadowColor: COLORS.neonBlue + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
    },
});
