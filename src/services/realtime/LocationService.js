import { supabase } from '../lib/supabase';

/**
 * Servicio de Geolocalización de Alta Frecuencia
 * Encargado de la transmisión y sincronización de coordenadas entre conductores y pasajeros.
 */
class LocationService {
    constructor() {
        this.subscription = null;
        this.updateInterval = null;
    }

    /**
     * Inicia la transmisión de ubicación del conductor
     * @param {string} driverId - UUID del conductor
     * @param {function} onLocationChange - Callback para obtener la ubicación actual
     */
    startBroadcasting(driverId, onLocationChange) {
        if (this.updateInterval) return;

        // Transmisión cada 2 segundos para alta precisión sin saturar
        this.updateInterval = setInterval(async () => {
            const location = await onLocationChange();
            if (!location) return;

            const { error } = await supabase
                .from('drivers')
                .update({
                    current_location: `POINT(${location.longitude} ${location.latitude})`,
                    bearing: location.heading || 0,
                    last_online_at: new Date().toISOString()
                })
                .eq('id', driverId);

            if (error) console.error('Error transmitiendo ubicación:', error);
        }, 2000);
    }

    /**
     * Escucha la ubicación de un conductor específico en tiempo real
     * @param {string} driverId - UUID del conductor a seguir
     * @param {function} callback - Función que recibe las nuevas coordenadas
     */
    subscribeToDriverLocation(driverId, callback) {
        this.subscription = supabase
            .channel(`driver_location_${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'drivers',
                    filter: `id=eq.${driverId}`
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();
    }

    stopAll() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        if (this.subscription) supabase.removeChannel(this.subscription);
    }
}

export const locationService = new LocationService();
