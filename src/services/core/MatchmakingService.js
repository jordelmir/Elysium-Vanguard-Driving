import { supabase } from '../lib/supabase';
import { pricingEngine } from './PricingEngine';

/**
 * MatchmakingService - Algoritmo de Asignación Inteligente
 * Encuentra y asigna automáticamente el mejor conductor para un viaje.
 */
class MatchmakingService {
    /**
     * Inicia la búsqueda y asignación de conductor
     * @param {string} rideId - UUID del viaje solicitado
     * @param {object} origin - { lat, lng } coordenadas de inicio
     */
    async findBestDriver(rideId, origin) {
        try {
            // 1. Obtener conductores cercanos usando la función RPC de PostGIS configurada antes
            const { data: nearbyDrivers, error: geoError } = await supabase.rpc('get_nearby_drivers', {
                lat: origin.lat,
                lng: origin.lng,
                radius_meters: 3000, // Radio inicial de 3km
                max_results: 5
            });

            if (geoError) throw geoError;

            if (!nearbyDrivers || nearbyDrivers.length === 0) {
                return { success: false, message: 'No hay conductores disponibles cerca' };
            }

            // 2. Selección inteligente (En este caso, el más cercano)
            // Se podría añadir lógica de reputación del conductor aquí.
            const bestDriver = nearbyDrivers[0];

            return {
                success: true,
                driver: bestDriver,
                estimatedArrival: this._calculateETA(bestDriver.distance_meters)
            };
        } catch (error) {
            console.error('Error en matchmaking:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calcula un ETA aproximado basado en la distancia y velocidad media urbana
     */
    _calculateETA(distanceMeters) {
        const averageSpeedKMH = 30; // 30 km/h velocidad media en ciudad
        const timeHours = (distanceMeters / 1000) / averageSpeedKMH;
        return Math.ceil(timeHours * 60); // Devuelve minutos
    }
}

export const matchmakingService = new MatchmakingService();
