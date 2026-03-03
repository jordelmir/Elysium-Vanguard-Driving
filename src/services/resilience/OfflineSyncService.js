import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

/**
 * OfflineSyncService - Gestión de Estado Offline y Resincronización
 * Almacena datos localmente cuando no hay red y los envía al recuperar conexión.
 */
class OfflineSyncService {
    constructor() {
        this.STORAGE_KEY = '@elysium_vanguard_offline_queue';
    }

    /**
     * Guarda un punto de ubicación en la cola local si falla la conexión
     */
    async queueLocationUpdate(locationData) {
        try {
            const currentQueueRaw = await AsyncStorage.getItem(this.STORAGE_KEY);
            const queue = currentQueueRaw ? JSON.parse(currentQueueRaw) : [];

            queue.push({
                ...locationData,
                timestamp: new Date().toISOString()
            });

            // Limitar cola a los últimos 100 puntos para evitar saturar memoria
            if (queue.length > 100) queue.shift();

            await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
            console.log('Ubicación guardada en cola offline');
        } catch (error) {
            console.error('Error en cola offline:', error);
        }
    }

    /**
     * Sincroniza todos los datos pendientes con Supabase
     */
    async syncPendingUpdates(driverId) {
        try {
            const currentQueueRaw = await AsyncStorage.getItem(this.STORAGE_KEY);
            if (!currentQueueRaw) return;

            const queue = JSON.parse(currentQueueRaw);
            if (queue.length === 0) return;

            console.log(`Sincronizando ${queue.length} puntos offline...`);

            // En una arquitectura real, usaríamos un endpoint de bulk upload
            // Para este ejemplo, enviamos el último punto conocido como estado actual
            const lastPoint = queue[queue.length - 1];

            const { error } = await supabase
                .from('drivers')
                .update({
                    current_location: `POINT(${lastPoint.longitude} ${lastPoint.latitude})`,
                    last_online_at: lastPoint.timestamp
                })
                .eq('id', driverId);

            if (!error) {
                await AsyncStorage.removeItem(this.STORAGE_KEY);
                console.log('Sincronización offline completada');
            }
        } catch (error) {
            console.error('Error sincronizando datos offline:', error);
        }
    }
}

export const offlineSyncService = new OfflineSyncService();
