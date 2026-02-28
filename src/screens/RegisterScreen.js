import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/colors';

export default function RegisterScreen({ navigation }) {
    const { register } = useAuth();
    const [step, setStep] = useState(1); // 1: role, 2: info, 3: vehicle (if driver)
    const [role, setRole] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [vehicleMake, setVehicleMake] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name || !email || !phone || !password) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            const vehicleInfo = role === 'driver' ? {
                make: vehicleMake,
                model: vehicleModel,
                plate: vehiclePlate.toUpperCase(),
                color: vehicleColor,
            } : null;

            await register(email.trim(), password, name, phone, role, vehicleInfo);
        } catch (error) {
            let msg = 'Error al registrarse';
            if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está en uso';
            else if (error.code === 'auth/invalid-email') msg = 'Email inválido';
            Alert.alert('Error', msg);
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Back button */}
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
                >
                    <Text style={styles.backBtnText}>← {step > 1 ? 'Anterior' : 'Volver'}</Text>
                </TouchableOpacity>

                {/* Step 1: Role Selection */}
                {step === 1 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.title}>¿Cómo quieres usar Elysium Vanguard Driving?</Text>
                        <Text style={styles.subtitle}>Selecciona tu rol</Text>

                        <TouchableOpacity
                            style={[styles.roleCard, role === 'rider' && styles.roleCardActive]}
                            onPress={() => { setRole('rider'); setStep(2); }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.roleIcon}>🧑</Text>
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
                            <Text style={styles.roleIcon}>🚗</Text>
                            <View style={styles.roleInfo}>
                                <Text style={styles.roleTitle}>Chofer</Text>
                                <Text style={styles.roleDesc}>Acepta viajes y gana con solo 1% de comisión</Text>
                            </View>
                            <Text style={styles.roleArrow}>→</Text>
                        </TouchableOpacity>

                        <View style={styles.commissionBadge}>
                            <Text style={styles.commissionText}>🎉 Comisión Elysium Vanguard Driving: solo 1%</Text>
                            <Text style={styles.commissionSub}>vs 25-50% de otras apps</Text>
                        </View>
                    </View>
                )}

                {/* Step 2: Personal Info */}
                {step === 2 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.title}>
                            {role === 'driver' ? '¡Bienvenido, chofer!' : '¡Bienvenido!'}
                        </Text>
                        <Text style={styles.subtitle}>Completa tu información</Text>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre completo</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Tu nombre"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Correo electrónico</Text>
                                <TextInput
                                    style={styles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="tu@email.com"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Teléfono</Text>
                                <TextInput
                                    style={styles.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="+506 8888-8888"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Contraseña</Text>
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Mínimo 6 caracteres"
                                    placeholderTextColor={COLORS.textMuted}
                                    secureTextEntry
                                />
                            </View>

                            {role === 'driver' ? (
                                <TouchableOpacity
                                    style={styles.primaryBtn}
                                    onPress={() => setStep(3)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.primaryBtnText}>Siguiente: Vehículo →</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                    onPress={handleRegister}
                                    disabled={loading}
                                    activeOpacity={0.8}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>Crear Cuenta</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Step 3: Vehicle Info (Drivers only) */}
                {step === 3 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.title}>Tu vehículo</Text>
                        <Text style={styles.subtitle}>Información de tu carro</Text>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Marca</Text>
                                <TextInput
                                    style={styles.input}
                                    value={vehicleMake}
                                    onChangeText={setVehicleMake}
                                    placeholder="Ej: Toyota"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Modelo</Text>
                                <TextInput
                                    style={styles.input}
                                    value={vehicleModel}
                                    onChangeText={setVehicleModel}
                                    placeholder="Ej: Corolla 2020"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Placa</Text>
                                <TextInput
                                    style={styles.input}
                                    value={vehiclePlate}
                                    onChangeText={setVehiclePlate}
                                    placeholder="Ej: ABC-123"
                                    placeholderTextColor={COLORS.textMuted}
                                    autoCapitalize="characters"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Color</Text>
                                <TextInput
                                    style={styles.input}
                                    value={vehicleColor}
                                    onChangeText={setVehicleColor}
                                    placeholder="Ej: Blanco"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                onPress={handleRegister}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryBtnText}>Crear Cuenta de Chofer</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Login link */}
                <TouchableOpacity
                    style={styles.loginLink}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.loginLinkText}>
                        ¿Ya tienes cuenta? <Text style={styles.loginLinkAccent}>Inicia sesión</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.lg,
        paddingTop: 60,
        paddingBottom: SPACING.xxl,
    },
    backBtn: {
        marginBottom: SPACING.lg,
    },
    backBtnText: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.md,
    },
    stepContainer: {
        flex: 1,
    },
    title: {
        fontSize: FONTS.sizes.xxl,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xl,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    roleCardActive: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(255, 107, 53, 0.08)',
    },
    roleIcon: {
        fontSize: 36,
        marginRight: SPACING.md,
    },
    roleInfo: {
        flex: 1,
    },
    roleTitle: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    roleDesc: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    roleArrow: {
        fontSize: 20,
        color: COLORS.accent,
        fontWeight: '700',
    },
    commissionBadge: {
        backgroundColor: COLORS.successBg,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(63, 185, 80, 0.3)',
    },
    commissionText: {
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        color: COLORS.success,
    },
    commissionSub: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    form: {
        gap: SPACING.md,
    },
    inputGroup: {
        gap: SPACING.xs,
    },
    label: {
        fontSize: FONTS.sizes.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginLeft: SPACING.xs,
    },
    input: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: 14,
        fontSize: FONTS.sizes.md,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    primaryBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.xl,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: SPACING.sm,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    primaryBtnText: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: '#ffffff',
    },
    loginLink: {
        alignItems: 'center',
        paddingVertical: SPACING.lg,
        marginTop: SPACING.md,
    },
    loginLinkText: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
    },
    loginLinkAccent: {
        color: COLORS.accent,
        fontWeight: '700',
    },
});
