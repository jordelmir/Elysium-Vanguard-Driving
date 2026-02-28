import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SPACING } from '../theme/colors';

// Screens
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RiderDashboard from '../screens/rider/RiderDashboard';
import RideTracking from '../screens/rider/RideTracking';
import RiderHistory from '../screens/rider/RiderHistory';
import DriverDashboard from '../screens/driver/DriverDashboard';
import ActiveRide from '../screens/driver/ActiveRide';
import DriverHistory from '../screens/driver/DriverHistory';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Simple icon component
function TabIcon({ name, color, size }) {
    const icons = {
        home: '🗺️',
        history: '📋',
        profile: '👤',
        car: '🚗',
        earnings: '💰',
    };
    return <Text style={{ fontSize: size - 4 }}>{icons[name] || '📍'}</Text>;
}

// Rider Bottom Tabs
function RiderTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.bgSecondary,
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 4,
                },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: {
                    fontSize: FONTS.sizes.xs,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="RiderHome"
                component={RiderDashboard}
                options={{
                    tabBarLabel: 'Inicio',
                    tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="RiderHistory"
                component={RiderHistory}
                options={{
                    tabBarLabel: 'Historial',
                    tabBarIcon: ({ color, size }) => <TabIcon name="history" color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
}

// Driver Bottom Tabs
function DriverTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.bgSecondary,
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 4,
                },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: {
                    fontSize: FONTS.sizes.xs,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="DriverHome"
                component={DriverDashboard}
                options={{
                    tabBarLabel: 'Inicio',
                    tabBarIcon: ({ color, size }) => <TabIcon name="car" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="DriverHistory"
                component={DriverHistory}
                options={{
                    tabBarLabel: 'Historial',
                    tabBarIcon: ({ color, size }) => <TabIcon name="earnings" color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { user, userData, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary }}>
                <Text style={{ color: COLORS.accent, fontSize: 18, fontWeight: 'bold' }}>Elysium Vanguard Driving</Text>
                <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>Cargando...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: COLORS.bgPrimary },
                }}
            >
                {!user ? (
                    // Auth screens
                    <>
                        <Stack.Screen name="Landing" component={LandingScreen} />
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                    </>
                ) : userData?.role === 'driver' ? (
                    // Driver screens
                    <>
                        <Stack.Screen name="DriverMain" component={DriverTabs} />
                        <Stack.Screen name="ActiveRide" component={ActiveRide} />
                    </>
                ) : (
                    // Rider screens
                    <>
                        <Stack.Screen name="RiderMain" component={RiderTabs} />
                        <Stack.Screen name="RideTracking" component={RideTracking} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
