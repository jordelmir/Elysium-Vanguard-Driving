import React from 'react';
import {
    StyleSheet,
    View,
    Dimensions,
    ScrollView,
    Platform
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { height } = Dimensions.get('window');

/**
 * DynamicBottomSheet - Panel inferior con límites de altura y scroll interno
 */
const DynamicBottomSheet = ({ translateY, children }) => {

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <BlurView intensity={95} tint="dark" style={styles.glass}>
                <View style={styles.dragHandle} />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {children}
                </ScrollView>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: height * 0.7, // Altura máxima estricta (70% de la pantalla)
        zIndex: 30, // Capa 3
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
    },
    glass: {
        flex: 1,
        paddingTop: 15,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 10,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
        paddingHorizontal: 20,
    }
});

export default DynamicBottomSheet;
