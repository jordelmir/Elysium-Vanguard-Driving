// Geolocation utilities for Elysium Vanguard Driving
import * as Location from 'expo-location';

/**
 * Request location permissions and get current position with highest accuracy
 */
export async function getCurrentLocation() {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
        throw new Error('Los servicios de ubicación están desactivados');
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Permiso de ubicación denegado');
    }

    // Get position with highest accuracy
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
    });

    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
    };
}

/**
 * Start watching location with continuous updates
 * @param {Function} callback - receives { latitude, longitude, heading, speed }
 * @returns {Object} subscription - call .remove() to stop watching
 */
export async function watchLocation(callback) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Permiso de ubicación denegado');
    }

    const subscription = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1, // Update every 1 meter for maximum precision
            timeInterval: 2000,   // Update every 2 seconds
        },
        (location) => {
            callback({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                heading: location.coords.heading,
                speed: location.coords.speed,
            });
        }
    );

    return subscription;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(latitude, longitude) {
    try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
            const addr = results[0];
            return `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || addr.subregion || ''}`.trim();
        }
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch {
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
}
