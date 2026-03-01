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
 * Search for places using OpenStreetMap Nominatim API
 * @param {string} query - The search query
 * @returns {Promise<Array>} List of matching places
 */
export async function searchPlaces(query, lat, lon) {
    if (!query || query.length < 3) return [];

    try {
        // Use a broader limit and prioritize Costa Rica with viewbox and countrycodes
        // viewbox: [min_lon, max_lat, max_lon, min_lat] for Costa Rica
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=15&addressdetails=1&countrycodes=cr&viewbox=-85.95,11.22,-82.55,8.03&bounded=1`;

        if (lat && lon) {
            url += `&lat=${lat}&lon=${lon}`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ElysiumVanguardDriving/1.0',
            },
        });
        const data = await response.json();

        return data.map((item) => ({
            id: item.place_id,
            name: item.display_name,
            shortName: item.name || (item.display_name.split(',')[0]),
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            address: item.display_name,
        }));
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
}

/**
 * Get place details (reverse geocode) using Nominatim
 */
export async function getPlaceDetails(latitude, longitude) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ElysiumVanguardDriving/1.0',
            },
        });
        const data = await response.json();

        if (data && data.display_name) {
            return {
                name: data.name || data.display_name.split(',')[0],
                address: data.display_name,
                latitude,
                longitude,
            };
        }

        // Fallback to coordinates
        return {
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            latitude,
            longitude,
        };
    } catch (error) {
        console.error('Error getting place details:', error);
        return {
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            latitude,
            longitude,
        };
    }
}

/**
 * Reverse geocode coordinates to address (Legacy fallback using Expo)
 */
export async function reverseGeocode(latitude, longitude) {
    try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
            const addr = results[0];
            const parts = [
                addr.street || '',
                addr.streetNumber || '',
                addr.city || addr.subregion || ''
            ].filter(p => p.length > 0);

            return parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch {
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
}
/**
 * Get route between two points using OSRM
 * @returns {Promise<Object>} { coordinates, distance, duration }
 */
export async function getRoute(lat1, lon1, lat2, lon2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                coordinates: route.geometry.coordinates.map(coord => ({
                    lat: coord[1],
                    lng: coord[0]
                })),
                distance: route.distance / 1000, // km
                duration: route.duration / 60,   // min
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting route:', error);
        return null;
    }
}
