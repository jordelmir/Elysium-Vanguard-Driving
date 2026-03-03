// Elysium Vanguard Driving - Geolocation utilities
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
 */
export async function watchLocation(callback) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Permiso de ubicación denegado');
    }

    const subscription = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1,
            timeInterval: 2000,
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
    const R = 6371;
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
 * ENHANCED Search for places - uses Photon (by Komoot) as primary & Nominatim as fallback.
 * Photon uses OpenStreetMap data but has much better fuzzy matching / autocomplete.
 */
export async function searchPlaces(query, lat, lon) {
    if (!query || query.length < 2) return [];

    try {
        // ---- Strategy 1: Photon API (better fuzzy / autocomplete) ----
        let photonResults = [];
        try {
            let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=12&lang=es`;
            if (lat && lon) {
                photonUrl += `&lat=${lat}&lon=${lon}`;
            }
            const photonRes = await fetch(photonUrl, {
                headers: { 'User-Agent': 'ElysiumVanguardDriving/1.0' },
            });
            const photonData = await photonRes.json();

            if (photonData?.features?.length > 0) {
                photonResults = photonData.features
                    .filter(f => {
                        // Prefer results in Costa Rica or nearby
                        const cc = f.properties?.countrycode;
                        return !cc || cc === 'CR' || cc === 'cr';
                    })
                    .map((f) => {
                        const props = f.properties || {};
                        const coords = f.geometry?.coordinates || [];
                        const shortName = props.name || props.street || query;
                        const addressParts = [
                            props.street,
                            props.housenumber,
                            props.city || props.locality,
                            props.state,
                            props.country,
                        ].filter(Boolean);

                        return {
                            id: `photon-${coords[0]}-${coords[1]}`,
                            name: addressParts.join(', ') || shortName,
                            shortName: shortName,
                            latitude: coords[1],
                            longitude: coords[0],
                            address: addressParts.join(', ') || shortName,
                            type: props.osm_value || props.type || 'place',
                            source: 'photon',
                        };
                    });
            }
        } catch (photonErr) {
            console.warn('Photon search failed, falling back to Nominatim:', photonErr);
        }

        // ---- Strategy 2: Nominatim (structured + detailed) ----
        let nominatimResults = [];
        try {
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=15&addressdetails=1&extratags=1&namedetails=1&countrycodes=cr&viewbox=-85.95,11.22,-82.55,8.03&bounded=0&dedupe=1`;
            if (lat && lon) {
                url += `&lat=${lat}&lon=${lon}`;
            }

            const response = await fetch(url, {
                headers: { 'User-Agent': 'ElysiumVanguardDriving/1.0' },
            });
            const data = await response.json();

            nominatimResults = data.map((item) => {
                const name = item.namedetails?.name || item.name || item.display_name.split(',')[0];
                return {
                    id: `nom-${item.place_id}`,
                    name: item.display_name,
                    shortName: name,
                    latitude: parseFloat(item.lat),
                    longitude: parseFloat(item.lon),
                    address: item.display_name,
                    type: item.type,
                    source: 'nominatim',
                };
            });
        } catch (nomErr) {
            console.warn('Nominatim search failed:', nomErr);
        }

        // ---- Merge & Deduplicate ----
        const seen = new Set();
        const merged = [];

        // Photon results first (better fuzzy matching)
        for (const r of photonResults) {
            const key = `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`;
            if (!seen.has(key) && r.latitude && r.longitude) {
                seen.add(key);
                merged.push(r);
            }
        }
        // Then Nominatim
        for (const r of nominatimResults) {
            const key = `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`;
            if (!seen.has(key) && r.latitude && r.longitude) {
                seen.add(key);
                merged.push(r);
            }
        }

        // Sort by distance if user location is available
        if (lat && lon) {
            merged.sort((a, b) => {
                const distA = calculateDistance(lat, lon, a.latitude, a.longitude);
                const distB = calculateDistance(lat, lon, b.latitude, b.longitude);
                return distA - distB;
            });
        }

        return merged.slice(0, 20);
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
            headers: { 'User-Agent': 'ElysiumVanguardDriving/1.0' },
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
 * Reverse geocode coordinates to address
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
 * Get route passing through multiple points using OSRM
 */
export async function getRoute(points) {
    try {
        if (!points || points.length < 2) return null;

        const coordinatesString = points
            .map(p => `${p.longitude},${p.latitude}`)
            .join(';');

        const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                coordinates: route.geometry.coordinates.map(coord => ({
                    lat: coord[1],
                    lng: coord[0]
                })),
                distance: route.distance / 1000,
                duration: route.duration / 60,
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting route:', error);
        return null;
    }
}
