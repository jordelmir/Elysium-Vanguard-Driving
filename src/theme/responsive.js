import { Dimensions, Platform, PixelRatio } from 'react-native';

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
 * Device size classification
 */
const DEVICE_SIZE = {
    SMALL: SCREEN_WIDTH < 360,
    MEDIUM: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 600,
    LARGE: SCREEN_WIDTH >= 600,
};

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
};
