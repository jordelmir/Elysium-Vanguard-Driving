import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal, Text } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme/colors';
import { moderateScale, scale } from '../theme/responsive';

const LoadingOverlay = ({ visible, message = 'Cargando...' }) => {
    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.container}>
                <View style={styles.card}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.text}>{message}</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: COLORS.bgSecondary,
        padding: scale(SPACING.xl),
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: scale(150),
    },
    text: {
        marginTop: scale(SPACING.md),
        color: COLORS.textPrimary,
        fontSize: moderateScale(16),
        fontWeight: '600',
    },
});

export default LoadingOverlay;
