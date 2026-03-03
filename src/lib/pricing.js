// Pricing engine for Elysium Vanguard Driving
// Costa Rica Colones (₡)

const BASE_FARE = 0;        // ₡0 tarifa base (as requested)
const PER_KM = 300;         // ₡300 por kilómetro
const PER_MINUTE = 60;      // ₡60 por minuto estimado
const MIN_FARE = 1000;      // ₡1,000 tarifa mínima
const COMMISSION_RATE = 0.01; // 1% comisión (as requested)

export function calculateSuggestedPrice(distanceKm, durationMinutes = null) {
    // Si no mandan duración real, estimamos 30km/h en ciudad
    const estimatedMinutes = durationMinutes !== null
        ? Math.max(2, Math.round(durationMinutes))
        : Math.max(2, Math.round((distanceKm / 30) * 60));

    // Simple calculation: Distance + Time (exact 300/km + 60/min)
    const distanceCost = Math.round((distanceKm || 0) * PER_KM);
    const timeCost = Math.round(estimatedMinutes * PER_MINUTE);

    // Total subtotal
    const subtotal = BASE_FARE + distanceCost + timeCost;

    // Math.max guarantees it never goes below MIN_FARE, Number.isNaN ensures safe fallback
    const total = Number.isNaN(subtotal) ? MIN_FARE : Math.max(subtotal, MIN_FARE);

    // Redondear a la centena más cercana (ej: 1450 -> 1500)
    const roundedTotal = Math.round(total / 100) * 100;

    return {
        baseFare: BASE_FARE,
        distanceCost,
        timeCost,
        distanceKm: Math.round((distanceKm || 0) * 10) / 10,
        estimatedMinutes,
        suggestedPrice: roundedTotal || MIN_FARE,
        trafficMultiplier: null // Removed extra traffic multipliers for predictable flat pricing
    };
}

/**
 * Calculate commission split
 * @param {number} acceptedPrice - final price accepted by both parties
 * @returns {object} commission breakdown
 */
export function calculateCommission(acceptedPrice) {
    const commission = Math.round(acceptedPrice * COMMISSION_RATE);
    const driverEarns = acceptedPrice - commission;

    return {
        totalPrice: acceptedPrice,
        commission,
        commissionRate: `${COMMISSION_RATE * 100}%`,
        driverEarns,
    };
}

/**
 * Format price in Costa Rican Colones
 */
export function formatPrice(amount) {
    return `₡${amount.toLocaleString('es-CR')}`;
}

/**
 * Generate price suggestions around a base price
 * @returns {array} array of 3 price options [base, higher1, higher2]
 */
export function generatePriceSuggestions(suggestedPrice) {
    const higher1 = Math.round((suggestedPrice * 1.10) / 100) * 100;
    const higher2 = Math.round((suggestedPrice * 1.25) / 100) * 100;

    return [
        { label: 'Automático', price: suggestedPrice },
        { label: 'Directo', price: higher1 },
        { label: 'Prioridad', price: higher2 },
    ];
}
