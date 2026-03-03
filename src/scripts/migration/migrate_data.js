/**
 * SCRIPT DE MIGRACIÓN: FIRESTORE A SUPABASE
 * 
 * Este script lee las colecciones de Firestore y las inserta en Supabase
 * transformando Geopoints a PostGIS y aplanando estructuras.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');
const { v5: uuidv5 } = require('uuid');

// Namespace para generación de UUID v5 (DEBE ser igual al de migrate_auth.js)
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// --- CONFIGURACIÓN ---
const serviceAccount = require('./serviceAccountKey.json');
const SUPABASE_URL = 'https://qwabtgonbulslmxoyjzo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWJ0Z29uYnVsc2xteG95anpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU0NDYyNSwiZXhwIjoyMDg4MTIwNjI1fQ.qzPYiOyGLu5WLKt_mTDO3eRBh20v0nMbLgMHG0QgSro';

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Convierte un UID de Firebase a un UUID determinista v5
 */
function toUuid(firebaseUid) {
    if (!firebaseUid) return null;
    return uuidv5(firebaseUid, NAMESPACE);
}

/**
 * Convierte un objeto de fecha de Firestore (Timestamp o similar) a ISO String
 */
function toISO(dateObj) {
    if (!dateObj) return new Date().toISOString();
    if (dateObj instanceof Date) return dateObj.toISOString();
    if (dateObj._seconds !== undefined) {
        return new Date(dateObj._seconds * 1000).toISOString();
    }
    try {
        return new Date(dateObj).toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}

async function migrateProfiles() {
    console.log('--- Migrando Profiles ---');
    const usersSnapshot = await db.collection('users').get();
    const profiles = [];

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        profiles.push({
            id: toUuid(doc.id),
            email: data.email,
            name: data.name,
            phone: data.phone,
            role: data.role,
            rating_sum: data.ratingSum || 0,
            rating_count: data.ratingCount || 0,
            total_rides: data.totalRides || 0,
            created_at: toISO(data.createdAt)
        });
    });

    const { error } = await supabase.from('profiles').upsert(profiles);
    if (error) console.error('Error migrando profiles:', error);
    else console.log(`Inertados ${profiles.length} perfiles.`);
}

async function migrateDrivers() {
    console.log('--- Migrando Drivers ---');
    const driversSnapshot = await db.collection('drivers').get();
    const drivers = [];

    for (const doc of driversSnapshot.docs) {
        const data = doc.data();
        const vehicle = data.vehicle || {};

        let point = null;
        if (data.location && data.location.latitude) {
            point = `POINT(${data.location.longitude} ${data.location.latitude})`;
        }

        drivers.push({
            id: toUuid(doc.id),
            is_online: data.isOnline || false,
            vehicle_make: vehicle.make,
            vehicle_model: vehicle.model,
            vehicle_plate: vehicle.plate,
            vehicle_color: vehicle.color,
            current_ride_id: toUuid(data.currentRideId),
            last_location: point,
            updated_at: toISO(data.updatedAt)
        });
    }

    const { error } = await supabase.from('drivers').upsert(drivers);
    if (error) console.error('Error migrando drivers:', error);
    else console.log(`Inertados ${drivers.length} conductores.`);
}

async function migrateRides() {
    console.log('--- Migrando Rides ---');
    const ridesSnapshot = await db.collection('rides').get();

    for (const doc of ridesSnapshot.docs) {
        const data = doc.data();
        const pickupPoint = data.pickup ? `POINT(${data.pickup.longitude} ${data.pickup.latitude})` : null;

        const { data: ride, error: rideError } = await supabase.from('rides').upsert({
            id: toUuid(doc.id),
            rider_id: toUuid(data.riderId),
            driver_id: toUuid(data.driverId),
            status: data.status,
            pickup_location: pickupPoint,
            pickup_address: (data.pickup && data.pickup.address) ? data.pickup.address : 'Sin dirección especificada',
            fare: data.fare || 0,
            distance_km: data.distance || 0,
            duration_min: data.duration || 0,
            created_at: toISO(data.createdAt)
        }).select().single();

        if (rideError) {
            console.error(`Error migrando ride ${doc.id}:`, rideError);
            continue;
        }

        if (data.dropoffs && Array.isArray(data.dropoffs)) {
            const stops = data.dropoffs.map((stop, index) => ({
                ride_id: toUuid(doc.id),
                stop_order: index,
                location: `POINT(${stop.longitude} ${stop.latitude})`,
                address: stop.address || 'Sin dirección especificada'
            }));

            const { error: stopsError } = await supabase.from('ride_stops').upsert(stops);
            if (stopsError) console.error(`Error migrando paradas de ride ${doc.id}:`, stopsError);
        }
    }
}

async function runMigration() {
    try {
        await migrateProfiles();
        await migrateDrivers();
        await migrateRides();
        console.log('MIGRACIÓN COMPLETADA EXITOSAMENTE');
    } catch (err) {
        console.error('ERROR FATAL EN MIGRACIÓN:', err);
    }
}

runMigration();
