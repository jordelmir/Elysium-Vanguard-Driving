import React from 'react';
import {
    StyleSheet,
    View,
    Dimensions,
    ScrollView,
    Platform,
    Keyboard,
    TouchableWithoutFeedback
} from 'react-native';
import Animated, {
    useAnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { height } = Dimensions.get('window');

/**
 * DynamicBottomSheet - Panel inferior con límites de altura y scroll interno
 * Diseñado para colapsar suavemente con el teclado sin invadir el header.
 */
const DynamicBottomSheet = ({ translateY, children, panHandlers }) => {

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <BlurView intensity={95} tint="dark" style={styles.glass}>
                <View {...panHandlers} style={styles.handleWrapper}>
                    <View style={styles.dragHandle} />
                    {/* Indicador visual para invitativo al deslizamiento */}
                    <View style={styles.peekHint}>
                        <View style={styles.hintDot} />
                        <View style={[styles.hintDot, { opacity: 0.5 }]} />
                        <View style={[styles.hintDot, { opacity: 0.2 }]} />
                    </View>
                </View>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
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
        height: height * 0.85, // Scroll Total - Expandible hasta casi arriba
        zIndex: 50,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
        backgroundColor: '#050505',
    },
    glass: {
        flex: 1,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    handleWrapper: {
        paddingTop: 10,
        paddingBottom: 25, // Mayor área para deslizar
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)', // Sutil diferencia táctil
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        marginBottom: 8,
    },
    peekHint: {
        flexDirection: 'row',
        gap: 4,
    },
    hintDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFF',
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
