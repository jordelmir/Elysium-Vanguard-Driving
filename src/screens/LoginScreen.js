import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/colors';

export default function LoginScreen({ navigation }) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Back button */}
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>← Volver</Text>
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.logoIcon}>🚗</Text>
                    <Text style={styles.title}>Bienvenido de vuelta</Text>
                    <Text style={styles.subtitle}>Inicia sesión en Elysium Vanguard Driving</Text>
                </View>

                <View style={styles.form}>
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
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Contraseña</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Tu contraseña"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.registerLink}
                        onPress={() => navigation.navigate('Register')}
                    >
                        <Text style={styles.registerLinkText}>
                            ¿No tienes cuenta? <Text style={styles.registerLinkAccent}>Regístrate</Text>
                        </Text>
                    </TouchableOpacity>
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
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.lg,
        paddingTop: 60,
    },
    backBtn: {
        marginBottom: SPACING.lg,
    },
    backBtnText: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.md,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logoIcon: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONTS.sizes.xxl,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
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
    loginBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.xl,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: SPACING.md,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    loginBtnDisabled: {
        opacity: 0.7,
    },
    loginBtnText: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '700',
        color: '#ffffff',
    },
    registerLink: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    registerLinkText: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
    },
    registerLinkAccent: {
        color: COLORS.accent,
        fontWeight: '700',
    },
});
