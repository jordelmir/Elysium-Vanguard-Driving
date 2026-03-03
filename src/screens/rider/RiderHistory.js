import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity, Platform, RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme/colors';
import { SAFE_TOP, scale, moderateScale } from '../../theme/responsive';

export default function RiderHistory() {
    const { user } = useAuth();
    const [rides, setRides] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRides = () => {
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
            setRefreshing(false);
        }, (error) => {
            console.error("Error fetching history:", error);
            setRefreshing(false);
        });
        return unsubscribe;
    };

    useEffect(() => {
        const unsubscribe = fetchRides();
        return () => unsubscribe && unsubscribe();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRides();
    };

    const renderRide = ({ item }) => {
        const dateObj = item.createdAt?.seconds
            ? new Date(item.createdAt.seconds * 1000)
            : null;
        const date = dateObj ? dateObj.toLocaleDateString('es-CR') : 'Fecha no disponible';
        const time = dateObj ? dateObj.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : '';
        const finalDropoff = item.dropoffs?.[item.dropoffs.length - 1] || item.dropoff;
        const stopCount = (item.dropoffs?.length || 1) - 1;

        return (
            <View style={styles.rideCard}>
                <View style={styles.rideHeader}>
                    <View>
                        <Text style={styles.rideDate}>{date}</Text>
                        {time ? <Text style={styles.rideTime}>{time}</Text> : null}
                    </View>
                    <Text style={styles.ridePrice}>
                        ₡{(item.acceptedPrice || item.proposedPrice || 0).toLocaleString()}
                    </Text>
                </View>

                <View style={styles.locationRow}>
                    <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.locationText}>{item.pickup?.name || 'Origen'}</Text>
                </View>
                {stopCount > 0 && (
                    <View style={styles.locationRow}>
                        <View style={[styles.dot, { backgroundColor: COLORS.warning }]} />
                        <Text style={styles.locationText}>{stopCount} parada{stopCount > 1 ? 's' : ''}</Text>
                    </View>
                )}
                <View style={styles.locationRow}>
                    <View style={[styles.dot, { backgroundColor: COLORS.error }]} />
                    <Text style={styles.locationText}>{finalDropoff?.name || 'Destino'}</Text>
                </View>

                <View style={styles.rideFooter}>
                    <Text style={styles.paymentBadge}>
                        {item.paymentMethod === 'sinpe' ? '📱 SINPE' : '💵 Efectivo'}
                    </Text>
                    {item.distance ? (
                        <Text style={styles.distanceBadge}>📏 {item.distance} km</Text>
                    ) : null}
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
    },
    subtitle: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textSecondary,
        marginTop: scale(2),
    },
    list: {
        padding: scale(SPACING.md),
        gap: scale(SPACING.sm),
    },
    rideCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        padding: scale(SPACING.md),
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        marginBottom: scale(SPACING.sm),
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
    ridePrice: {
        fontSize: moderateScale(FONTS.sizes.lg),
        fontWeight: '800',
        color: COLORS.accent,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: scale(4),
        gap: scale(SPACING.sm),
    },
    dot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
    },
    locationText: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textSecondary,
        flex: 1,
    },
    rideFooter: {
        flexDirection: 'row',
        marginTop: scale(SPACING.sm),
        paddingTop: scale(SPACING.sm),
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    paymentBadge: {
        fontSize: moderateScale(FONTS.sizes.sm),
        color: COLORS.textMuted,
    },
    distanceBadge: {
        fontSize: moderateScale(FONTS.sizes.sm),
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
