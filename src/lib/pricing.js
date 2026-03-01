// Pricing engine for Elysium Vanguard Driving
// Costa Rica Colones (₡)

const BASE_FARE = 0;      // ₡500 tarifa base
const PER_KM = 300;         // ₡300 por kilómetro
const PER_MINUTE = 60;      // ₡60 por minuto estimado
const MIN_FARE = 1000;      // ₡1,000 tarifa mínima
const COMMISSION_RATE = 0.01; // 1% comisión de la plataforma

export function calculateSuggestedPrice(distanceKm, durationMinutes = null) {
    // If real duration is provided, use it. Otherwise estimate: average 30km/h in city → minutes = (distance / 30) * 60
    const estimatedMinutes = durationMinutes !== null ? Math.max(2, Math.round(durationMinutes)) : Math.max(2, Math.round((distanceKm / 30) * 60));

    // Determine traffic multiplier based on time of day
    // Peak hours: 7-9 AM, 5-7 PM
    const now = new Date();
    const hour = now.getHours();
    let trafficMultiplier = 1.0;

    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        trafficMultiplier = 1.3; // 30% increase during peak hours
    } else if (hour >= 22 || hour <= 5) {
        trafficMultiplier = 1.2; // 20% increase for night service
    }

    const distanceCost = Math.round((distanceKm || 0) * PER_KM);
    const timeCost = Math.round(estimatedMinutes * PER_MINUTE);
    const subtotal = (BASE_FARE + distanceCost + timeCost) * trafficMultiplier;
    const total = Number.isNaN(subtotal) ? MIN_FARE : Math.max(subtotal, MIN_FARE);

    // Round to nearest 100 colones
    const roundedTotal = Math.round(total / 100) * 100;

    return {
        baseFare: BASE_FARE,
        distanceCost,
        timeCost,
        distanceKm: Math.round((distanceKm || 0) * 10) / 10,
        estimatedMinutes,
        suggestedPrice: roundedTotal || MIN_FARE,
        trafficMultiplier: trafficMultiplier > 1 ? `${Math.round((trafficMultiplier - 1) * 100)}% extra` : null
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
