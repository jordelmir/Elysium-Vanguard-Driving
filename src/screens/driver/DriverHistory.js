import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, StyleSheet, Platform, RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatPrice, calculateCommission } from '../../lib/pricing';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { SAFE_TOP, scale, moderateScale } from '../../theme/responsive';

export default function DriverHistory() {
    const { user } = useAuth();
    const [rides, setRides] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [totalCommission, setTotalCommission] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHistory = () => {
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
            setRefreshing(false);
        }, (error) => {
            console.error("Error fetching history:", error);
            setRefreshing(false);
        });

        return unsubscribe;
    };

    useEffect(() => {
        const unsubscribe = fetchHistory();
        return () => unsubscribe && unsubscribe();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const renderRide = ({ item }) => {
        const price = item.acceptedPrice || item.proposedPrice || 0;
        const { driverEarns, commission } = calculateCommission(price);
        const dateObj = item.createdAt?.seconds
            ? new Date(item.createdAt.seconds * 1000)
            : null;
        const date = dateObj ? dateObj.toLocaleDateString('es-CR') : '';
        const time = dateObj ? dateObj.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : '';
        const finalDropoff = item.dropoffs?.[item.dropoffs.length - 1] || item.dropoff;

        return (
            <View style={styles.rideCard}>
                <View style={styles.rideHeader}>
                    <View>
                        <Text style={styles.rideDate}>{date}</Text>
                        {time ? <Text style={styles.rideTime}>{time}</Text> : null}
                    </View>
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
                            {finalDropoff?.name || 'Destino'}
                        </Text>
                    </View>
                </View>

                <View style={styles.rideFooter}>
                    <Text style={styles.paymentTag}>
                        {item.paymentMethod === 'sinpe' ? '📱 SINPE' : '💵 Efectivo'}
                    </Text>
                    <Text style={styles.riderNameTag}>👤 {item.riderName || 'Pasajero'}</Text>
                    {item.distance ? (
                        <Text style={styles.distanceTag}>📏 {item.distance} km</Text>
                    ) : null}
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
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={COLORS.accent}
                            colors={[COLORS.accent]}
                            backgroundColor={COLORS.bgPrimary}
                        />
                    }
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
        paddingTop: SAFE_TOP,
        paddingHorizontal: scale(SPACING.lg),
        paddingBottom: scale(SPACING.md),
        backgroundColor: COLORS.bgSecondary,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: {
        fontSize: moderateScale(FONTS.sizes.xxl),
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: scale(SPACING.md),
    },
    statsRow: {
        flexDirection: 'row',
        gap: scale(SPACING.sm),
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.md,
        padding: scale(SPACING.sm),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    statValue: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '800',
        color: COLORS.accent,
    },
    statValueSmall: {
        fontSize: moderateScale(FONTS.sizes.md),
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    statLabel: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
        marginTop: scale(2),
    },
    list: {
        padding: scale(SPACING.md),
    },
    rideCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: scale(SPACING.md),
        marginBottom: scale(SPACING.sm),
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(SPACING.sm),
    },
    rideDate: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textMuted,
    },
    rideTime: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
        marginTop: scale(2),
    },
    earningsCol: {
        alignItems: 'flex-end',
    },
    rideEarnings: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '800',
        color: COLORS.accent,
    },
    commissionText: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
    },
    routeEl: {
        gap: scale(SPACING.xs),
        marginBottom: scale(SPACING.sm),
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(SPACING.sm),
    },
    dot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
    },
    routeText: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textSecondary,
        flex: 1,
    },
    rideFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: scale(SPACING.sm),
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    paymentTag: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
    },
    riderNameTag: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
    },
    distanceTag: {
        fontSize: moderateScale(FONTS.sizes.xs),
        color: COLORS.textMuted,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: scale(64),
        marginBottom: scale(SPACING.md),
    },
    emptyText: {
        fontSize: moderateScale(FONTS.sizes.xl),
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    emptySubtext: {
        fontSize: moderateScale(FONTS.sizes.md),
        color: COLORS.textSecondary,
        marginTop: scale(SPACING.xs),
    },
});
