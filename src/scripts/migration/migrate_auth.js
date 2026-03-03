/**
 * SCRIPT DE MIGRACIÓN: FIREBASE AUTH A SUPABASE AUTH
 * 
 * Este script exporta usuarios de Firebase y los crea en Supabase Auth
 * manteniendo el mismo UID.
 */

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const { v5: uuidv5 } = require('uuid');

// Namespace para generación de UUID v5 (puede ser cualquier UUID válido)
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const serviceAccount = require('./serviceAccountKey.json');
const SUPABASE_URL = 'https://qwabtgonbulslmxoyjzo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWJ0Z29uYnVsc2xteG95anpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU0NDYyNSwiZXhwIjoyMDg4MTIwNjI1fQ.qzPYiOyGLu5WLKt_mTDO3eRBh20v0nMbLgMHG0QgSro';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateAuthUsers() {
    console.log('Iniciando migración de usuarios de Auth...');

    let nextPageToken;
    do {
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

        for (const userRecord of listUsersResult.users) {
            const deterministicUuid = uuidv5(userRecord.uid, NAMESPACE);
            console.log(`Migrando usuario: ${userRecord.email} (Firebase UID: ${userRecord.uid} -> Supabase UUID: ${deterministicUuid})`);

            const { data, error } = await supabase.auth.admin.createUser({
                id: deterministicUuid,
                email: userRecord.email,
                email_confirm: true,
                user_metadata: {
                    displayName: userRecord.displayName,
                    firebase_uid: userRecord.uid,
                    source: 'firebase_migration'
                }
            });

            if (error) {
                if (error.message.includes('already exists')) {
                    console.log(`Usuario ${userRecord.email} ya existe en Supabase.`);
                } else {
                    console.error(`Error migrando ${userRecord.email}:`, error.message);
                }
            }
        }
        nextPageToken = listUsersResult.nextPageToken;
    } while (nextPageToken);

    console.log('Migración de Auth completa.');
}

migrateAuthUsers().catch(console.error);
