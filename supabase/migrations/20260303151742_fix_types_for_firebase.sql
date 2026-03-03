-- Migración de limpieza profunda para corregir tipos de UUID a TEXT
-- 1. Eliminar políticas RLS individualmente
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('profiles', 'drivers', 'rides', 'ride_stops')
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 2. Eliminar foreign keys dinámicamente
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname, relname 
        FROM pg_constraint c 
        JOIN pg_class cl ON cl.oid = c.conrelid 
        JOIN pg_namespace n ON n.oid = cl.relnamespace 
        WHERE n.nspname = 'public' AND cl.relname IN ('profiles', 'drivers', 'rides', 'ride_stops') AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.relname) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Cambiar tipos de columna a TEXT
ALTER TABLE public.profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.rides ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.drivers ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.rides ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.rides ALTER COLUMN rider_id TYPE TEXT;
ALTER TABLE public.rides ALTER COLUMN driver_id TYPE TEXT;
ALTER TABLE public.ride_stops ALTER COLUMN ride_id TYPE TEXT;

-- 4. Restaurar foreign keys
ALTER TABLE public.drivers ADD CONSTRAINT drivers_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.rides ADD CONSTRAINT rides_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.profiles(id);
ALTER TABLE public.rides ADD CONSTRAINT rides_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id);
ALTER TABLE public.ride_stops ADD CONSTRAINT ride_stops_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES public.rides(id) ON DELETE CASCADE;

-- 5. Restaurar políticas
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Riders can see their own rides." ON public.rides FOR SELECT USING (auth.uid()::text = rider_id);
CREATE POLICY "Drivers can see assigned rides." ON public.rides FOR SELECT USING (auth.uid()::text = driver_id);
CREATE POLICY "Drivers can update their own location." ON public.drivers FOR UPDATE USING (auth.uid()::text = id);
