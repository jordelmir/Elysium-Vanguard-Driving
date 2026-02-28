import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';

export default function RiderHistory() {
    const { user } = useAuth();
    const [rides, setRides] = useState([]);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'rides'),
            where('riderId', '==', user.uid),
            where('status', '==', 'completed')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            // Sort by createdAt descending
            list.sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
            });
            setRides(list);
        });
        return unsubscribe;
    }, [user]);

    const renderRide = ({ item }) => {
        const date = item.createdAt?.seconds
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('es-CR')
            : 'Fecha no disponible';

        return (
            <View style={styles.rideCard}>
                <View style={styles.rideHeader}>
                    <Text style={styles.rideDate}>{date}</Text>
                    <Text style={styles.ridePrice}>
                        ₡{(item.acceptedPrice || item.proposedPrice || 0).toLocaleString()}
                    </Text>
                </View>

                <View style={styles.locationRow}>
                    <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.locationText}>{item.pickup?.name || 'Origen'}</Text>
                </View>
                <View style={styles.locationRow}>
                    <View style={[styles.dot, { backgroundColor: COLORS.error }]} />
                    <Text style={styles.locationText}>{item.dropoff?.name || 'Destino'}</Text>
                </View>

                <View style={styles.rideFooter}>
                    <Text style={styles.paymentBadge}>
                        {item.paymentMethod === 'sinpe' ? '📱 SINPE' : '💵 Efectivo'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Historial de Viajes</Text>
                <Text style={styles.subtitle}>{rides.length} viajes completados</Text>
            </View>

            {rides.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>🗺️</Text>
                    <Text style={styles.emptyText}>Aún no tienes viajes</Text>
                    <Text style={styles.emptySubtext}>¡Solicita tu primer viaje!</Text>
                </View>
            ) : (
                <FlatList
                    data={rides}
                    renderItem={renderRide}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.bgSecondary,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: {
        fontSize: FONTS.sizes.xxl,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    list: {
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    rideCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        marginBottom: SPACING.sm,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    rideDate: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textMuted,
    },
    ridePrice: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '800',
        color: COLORS.accent,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
        gap: SPACING.sm,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    locationText: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        flex: 1,
    },
    rideFooter: {
        flexDirection: 'row',
        marginTop: SPACING.sm,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    paymentBadge: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textMuted,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    emptyText: {
        fontSize: FONTS.sizes.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    emptySubtext: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
});
