/**
 * PricingEngine - Motor de Tarifas Inteligente
 * Calcula costos basados en distancia, tiempo y factores de demanda dinámica.
 */
class PricingEngine {
    constructor() {
        this.BASE_FARE = 1000;      // Tarifa base en moneda local
        this.PRICE_PER_KM = 300;    // Costo por kilómetro
        this.PRICE_PER_MIN = 60;    // Costo por minuto
        this.MINIMUM_FARE = 1500;   // Tarifa mínima de servicio
    }

    /**
     * Calcula la estimación de precio para un viaje
     * @param {number} distanceKm - Distancia total estimada
     * @param {number} durationMin - Duración estimada en minutos
     * @param {number} demandFactor - Factor de demanda (1.0 = normal, 1.5 = alta demanda)
     * @returns {object} Detalle del desglose de precio
     */
    calculateEstimate(distanceKm, durationMin, demandFactor = 1.0) {
        const distanceCost = distanceKm * this.PRICE_PER_KM;
        const timeCost = durationMin * this.PRICE_PER_MIN;

        let subtotal = this.BASE_FARE + distanceCost + timeCost;

        // Aplicar tarifa dinámica (Surge Pricing)
        const surgeExtra = subtotal * (demandFactor - 1.0);
        const total = Math.max(subtotal + surgeExtra, this.MINIMUM_FARE);

        return {
            baseFare: this.BASE_FARE,
            distanceCost: Math.round(distanceCost),
            timeCost: Math.round(timeCost),
            surgeMultiplier: demandFactor.toFixed(1),
            total: Math.round(total)
        };
    }

    /**
     * Determina el factor de demanda basado en geocercas
     * En una implementación real, esto consultaría Redis/PostGIS para ver la relación oferta/demanda.
     */
    async getDemandFactor(lat, lng) {
        // Simulación de lógica de negocio:
        // Si hay más del 80% de conductores ocupados en la zona, aumentar multiplicador.
        return 1.2; // Por ahora devolvemos un factor estático del 20% extra
    }
}

export const pricingEngine = new PricingEngine();
