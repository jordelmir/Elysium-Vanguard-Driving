import { Dimensions, Platform, PixelRatio, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scaled size based on screen width.
 * Useful for width, padding, margin, etc.
 */
const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scaled size based on screen height.
 * Useful for heights, vertical padding, etc.
 */
const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Moderate scale that allows setting factor to control scaling intensity.
 * Useful for font sizes.
 */
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Device size classification - Refined for better precision
 */
const DEVICE_SIZE = {
    SMALL: SCREEN_WIDTH < 360,
    MEDIUM: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 414, // iPhone 11/12/13/14 standard
    LARGE: SCREEN_WIDTH >= 414 && SCREEN_WIDTH < 768, // Max/Plus models
    TABLET: SCREEN_WIDTH >= 768 && SCREEN_WIDTH < 1024,
    DESKTOP: SCREEN_WIDTH >= 1024,
};

/**
 * Safe area helpers for common UI elements
 */
const SAFE_TOP = Platform.OS === 'ios' ? (SCREEN_HEIGHT > 800 ? 55 : 30) : StatusBar.currentHeight || 24;
const SAFE_BOTTOM = Platform.OS === 'ios' ? (SCREEN_HEIGHT > 800 ? 34 : 15) : 15;

/**
 * Grid-like utilities
 */
const getGridColumns = () => {
    if (DEVICE_SIZE.LARGE) return 3;
    if (DEVICE_SIZE.MEDIUM) return 2;
    return 1;
};

export {
    scale,
    verticalScale,
    moderateScale,
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    DEVICE_SIZE,
    getGridColumns,
    SAFE_TOP,
    SAFE_BOTTOM,
};
