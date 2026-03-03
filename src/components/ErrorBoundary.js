import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme/colors';
import { moderateScale, scale } from '../theme/responsive';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    handleRestart = () => {
        this.setState({ hasError: false, error: null });
        // This will re-render the children, usually enough for simple crashes
    };

    render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.icon}>⚠️</Text>
                        <Text style={styles.title}>¡Ups! Algo salió mal</Text>
                        <Text style={styles.message}>
                            La aplicación ha encontrado un problema inesperado. No te preocupes, tus datos están a salvo.
                        </Text>
                        <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
                            <Text style={styles.buttonText}>Intentar de nuevo</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(SPACING.xl),
    },
    icon: {
        fontSize: scale(64),
        marginBottom: scale(SPACING.lg),
    },
    title: {
        fontSize: moderateScale(22),
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: scale(SPACING.md),
        textAlign: 'center',
    },
    message: {
        fontSize: moderateScale(16),
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: scale(SPACING.xl),
        lineHeight: moderateScale(24),
    },
    button: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: scale(SPACING.xl),
        paddingVertical: scale(SPACING.md),
        borderRadius: RADIUS.full,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: moderateScale(16),
        fontWeight: '700',
    },
});

export default ErrorBoundary;
