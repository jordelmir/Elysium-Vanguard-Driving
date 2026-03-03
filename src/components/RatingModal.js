import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Modal,
    Dimensions, Animated, Platform
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme/colors';
import { scale, moderateScale } from '../theme/responsive';

const { width } = Dimensions.get('window');

export default function RatingModal({ visible, onFinish, type }) {
    const [rating, setRating] = useState(10);
    const [submitting, setSubmitting] = useState(false);

    const handleFinish = async () => {
        setSubmitting(true);
        await onFinish(rating);
        setSubmitting(false);
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 10; i++) {
            stars.push(
                <TouchableOpacity
                    key={i}
                    onPress={() => setRating(i)}
                    style={[
                        styles.starButton,
                        rating >= i && styles.starButtonActive
                    ]}
                >
                    <Text style={[
                        styles.starText,
                        rating >= i && styles.starTextActive
                    ]}>
                        {i}
                    </Text>
                </TouchableOpacity>
            );
        }
        return stars;
    };

    const getRatingLabel = () => {
        if (rating === 10) return '¡Excelente!';
        if (rating >= 8) return 'Muy bueno';
        if (rating >= 7) return 'Recomendado';
        if (rating >= 6) return 'Regular';
        return 'Malo';
    };

    const getRatingColor = () => {
        if (rating >= 7) return COLORS.success;
        if (rating >= 6) return COLORS.warning;
        return COLORS.error;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <Text style={styles.title}>
                        Califica a tu {type === 'driver' ? 'Chofer' : 'Pasajero'}
                    </Text>
                    <Text style={styles.subtitle}>
                        Tu opinión de 1 a 10 estrellas ayuda a mantener la comunidad segura.
                    </Text>

                    <Text style={[styles.label, { color: getRatingColor() }]}>
                        {getRatingLabel()} ({rating * 10}%)
                    </Text>

                    <View style={styles.starsContainer}>
                        {renderStars()}
                    </View>

                    <TouchableOpacity
                        style={[styles.finishBtn, submitting && { opacity: 0.7 }]}
                        onPress={handleFinish}
                        disabled={submitting}
                    >
                        <Text style={styles.finishBtnText}>
                            {submitting ? 'Guardando...' : 'Finalizar Calificación'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(SPACING.lg),
    },
    content: {
        width: '100%',
        maxWidth: scale(500), // Limit width on tablets/web
        backgroundColor: COLORS.bgSecondary,
        borderRadius: RADIUS.xl,
        padding: scale(SPACING.xl),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    title: {
        fontSize: moderateScale(22),
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: scale(SPACING.sm),
    },
    subtitle: {
        fontSize: moderateScale(14),
        color: COLORS.textMuted,
        textAlign: 'center',
        marginBottom: scale(SPACING.xl),
    },
    label: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginBottom: scale(SPACING.md),
    },
    starsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: scale(8),
        marginBottom: scale(SPACING.xl),
    },
    starButton: {
        width: scale(45),
        height: scale(45),
        borderRadius: scale(22.5),
        backgroundColor: COLORS.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    starButtonActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    starText: {
        color: COLORS.textMuted,
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    starTextActive: {
        color: COLORS.bgPrimary,
    },
    finishBtn: {
        width: '100%',
        height: scale(55),
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(SPACING.md),
    },
    finishBtnText: {
        color: COLORS.bgPrimary,
        fontSize: moderateScale(18),
        fontWeight: 'bold',
    },
});

