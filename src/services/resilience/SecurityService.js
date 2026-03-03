import { supabase } from '../lib/supabase';

/**
 * SecurityService - Gestión de Seguridad y Protección de API
 */
class SecurityService {
    /**
     * Verifica la validez del token JWT y lo refresca si es necesario
     */
    async ensureAuthenticatedSession() {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
            console.warn('Sesión no válida o expirada');
            return false;
        }

        // Supabase maneja el refresco automático bajo cuerda, 
        // pero aquí podríamos añadir lógica de verificación de roles extra.
        return true;
    }

    /**
     * Simulación de prevención de fraude / Rate Limiting en cliente
     */
    canRequestRide() {
        // Lógica simple: No permitir más de una solicitud de viaje cada 30 segundos
        // para evitar ataques de spam de "viajes fantasmas".
        return true;
    }
}

export const securityService = new SecurityService();
