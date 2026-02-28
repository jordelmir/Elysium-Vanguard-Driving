import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, StyleSheet, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatPrice, calculateCommission } from '../../lib/pricing';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';

export default function DriverHistory() {
    const { user } = useAuth();
    const [rides, setRides] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalCommission, setTotalCommission] = useState(0);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'rides'),
            where('driverId', '==', user.uid),
            where('status', '==', 'completed')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            let earnings = 0;
            let commission = 0;

            snapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                list.push(data);
                const price = data.acceptedPrice || data.proposedPrice || 0;
                const comm = calculateCommission(price);
                earnings += comm.driverEarns;
                commission += comm.commission;
            });

            list.sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
            });

            setRides(list);
            setTotalEarnings(earnings);
            setTotalCommission(commission);
        });

        return unsubscribe;
    }, [user]);

    const renderRide = ({ item }) => {
        const price = item.acceptedPrice || item.proposedPrice || 0;
        const { driverEarns, commission } = calculateCommission(price);
        const date = item.createdAt?.seconds
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('es-CR')
            : '';

        return (
            <View style={styles.rideCard}>
                <View style={styles.rideHeader}>
                    <Text style={styles.rideDate}>{date}</Text>
                    <View style={styles.earningsCol}>
                        <Text style={styles.rideEarnings}>{formatPrice(driverEarns)}</Text>
                        <Text style={styles.commissionText}>-{formatPrice(commission)} (1%)</Text>
                    </View>
                </View>

                <View style={styles.routeEl}>
                    <View style={styles.routeRow}>
                        <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.routeText} numberOfLines={1}>
                            {item.pickup?.name || 'Origen'}
                        </Text>
                    </View>
                    <View style={styles.routeRow}>
                        <View style={[styles.dot, { backgroundColor: COLORS.error }]} />
                        <Text style={styles.routeText} numberOfLines={1}>
                            {item.dropoff?.name || 'Destino'}
                        </Text>
                    </View>
                </View>

                <View style={styles.rideFooter}>
                    <Text style={styles.paymentTag}>
                        {item.paymentMethod === 'sinpe' ? '📱 SINPE' : '💵 Efectivo'}
                    </Text>
                    <Text style={styles.riderNameTag}>👤 {item.riderName || 'Pasajero'}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Ganancias</Text>

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{formatPrice(totalEarnings)}</Text>
                        <Text style={styles.statLabel}>Ganado total</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValueSmall}>{rides.length}</Text>
                        <Text style={styles.statLabel}>Viajes</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValueSmall, { color: COLORS.warning }]}>
                            {formatPrice(totalCommission)}
                        </Text>
                        <Text style={styles.statLabel}>Comisión (1%)</Text>
                    </View>
                </View>
            </View>

            {rides.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>💰</Text>
                    <Text style={styles.emptyText}>Sin viajes aún</Text>
                    <Text style={styles.emptySubtext}>¡Conéctate y empieza a ganar!</Text>
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
        marginBottom: SPACING.md,
    },
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    statValue: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '800',
        color: COLORS.accent,
    },
    statValueSmall: {
        fontSize: FONTS.sizes.md,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    statLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    list: {
        padding: SPACING.md,
    },
    rideCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
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
    earningsCol: {
        alignItems: 'flex-end',
    },
    rideEarnings: {
        fontSize: FONTS.sizes.lg,
        fontWeight: '800',
        color: COLORS.accent,
    },
    commissionText: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
    },
    routeEl: {
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    routeText: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        flex: 1,
    },
    rideFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    paymentTag: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
    },
    riderNameTag: {
        fontSize: FONTS.sizes.xs,
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
