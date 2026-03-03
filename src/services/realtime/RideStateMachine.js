import { supabase } from '../lib/supabase';

/**
 * RideStateMachine - Gestor de Estados de Viaje
 * Implementa la lógica de transición de estados para asegurar la consistencia del negocio.
 */
export const RIDE_STATUS = {
    REQUESTED: 'requested',
    ACCEPTED: 'accepted',
    ARRIVING: 'arriving',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

class RideStateMachine {
    /**
     * Transiciona un viaje a un nuevo estado verificando validez lógica
     * @param {string} rideId - UUID del viaje
     * @param {string} nextStatus - Nuevo estado deseado
     * @param {object} additionalData - Datos extra (como driver_id al aceptar)
     */
    async transitionTo(rideId, nextStatus, additionalData = {}) {
        // 1. Obtener estado actual
        const { data: ride, error: fetchError } = await supabase
            .from('rides')
            .select('status')
            .eq('id', rideId)
            .single();

        if (fetchError || !ride) throw new Error('Viaje no encontrado');

        // 2. Validar transición lógica (Simplificado para el ejemplo)
        const isValid = this._validateTransition(ride.status, nextStatus);
        if (!isValid) throw new Error(`Transición inválida de ${ride.status} a ${nextStatus}`);

        // 3. Ejecutar actualización
        const { data, error: updateError } = await supabase
            .from('rides')
            .update({
                status: nextStatus,
                ...additionalData,
                updated_at: new Date().toISOString()
            })
            .eq('id', rideId)
            .select()
            .single();

        if (updateError) throw updateError;
        return data;
    }

    _validateTransition(current, next) {
        const transitions = {
            [RIDE_STATUS.REQUESTED]: [RIDE_STATUS.ACCEPTED, RIDE_STATUS.CANCELLED],
            [RIDE_STATUS.ACCEPTED]: [RIDE_STATUS.ARRIVING, RIDE_STATUS.CANCELLED],
            [RIDE_STATUS.ARRIVING]: [RIDE_STATUS.IN_PROGRESS, RIDE_STATUS.CANCELLED],
            [RIDE_STATUS.IN_PROGRESS]: [RIDE_STATUS.COMPLETED],
            [RIDE_STATUS.COMPLETED]: [],
            [RIDE_STATUS.CANCELLED]: []
        };
        return transitions[current]?.includes(next) || false;
    }

    /**
     * Suscripción en tiempo real a cambios de estado para el pasajero/conductor
     */
    subscribeToRideChanges(rideId, onUpdate) {
        return supabase
            .channel(`ride_updates_${rideId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
                (payload) => onUpdate(payload.new)
            )
            .subscribe();
    }
}

export const rideStateMachine = new RideStateMachine();
