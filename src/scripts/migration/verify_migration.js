const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');

const serviceAccount = require('./serviceAccountKey.json');
const SUPABASE_URL = 'https://qwabtgonbulslmxoyjzo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWJ0Z29uYnVsc2xteG95anpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU0NDYyNSwiZXhwIjoyMDg4MTIwNjI1fQ.qzPYiOyGLu5WLKt_mTDO3eRBh20v0nMbLgMHG0QgSro';

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    console.log('--- VERIFICACIÓN DE MIGRACIÓN ---');

    // 1. Auth Users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    console.log(`Supabase Auth Users: ${authUsers ? authUsers.users.length : 0}`);

    // 2. Profiles
    const { count: profileCount, error: profileError } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const firebaseUsers = await db.collection('users').count().get();
    console.log(`Profiles: Supabase=${profileCount} vs Firebase=${firebaseUsers.data().count}`);

    // 3. Drivers
    const { count: driverCount, error: driverError } = await supabase.from('drivers').select('*', { count: 'exact', head: true });
    const firebaseDrivers = await db.collection('drivers').count().get();
    console.log(`Drivers: Supabase=${driverCount} vs Firebase=${firebaseDrivers.data().count}`);

    // 4. Rides
    const { count: rideCount, error: rideError } = await supabase.from('rides').select('*', { count: 'exact', head: true });
    const firebaseRides = await db.collection('rides').count().get();
    console.log(`Rides: Supabase=${rideCount} vs Firebase=${firebaseRides.data().count}`);

}

verify().catch(console.error);
