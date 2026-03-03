-- Elysium Vanguard Driving: Initial Relational Schema
-- PostGIS for high-performance geolocation

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    role TEXT CHECK (role IN ('rider', 'driver')),
    rating_sum FLOAT DEFAULT 0,
    rating_count INT DEFAULT 0,
    total_rides INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Drivers Table (Extension of Profile)
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_plate TEXT,
    vehicle_color TEXT,
    current_ride_id TEXT,
    last_location GEOGRAPHY(POINT, 4326),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Rides Table
CREATE TABLE IF NOT EXISTS public.rides (
    id TEXT PRIMARY KEY,
    rider_id TEXT REFERENCES public.profiles(id),
    driver_id TEXT REFERENCES public.profiles(id),
    status TEXT CHECK (status IN ('pending', 'accepted', 'ongoing', 'completed', 'cancelled')),
    
    pickup_location GEOGRAPHY(POINT, 4326),
    pickup_address TEXT,
    
    fare FLOAT,
    distance_km FLOAT,
    duration_min FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ride Stops (Multi-stop support)
CREATE TABLE IF NOT EXISTS public.ride_stops (
    id BIGSERIAL PRIMARY KEY,
    ride_id TEXT NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    address TEXT
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_stops ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Riders can see their own rides." ON public.rides FOR SELECT USING (auth.uid() = rider_id);
CREATE POLICY "Drivers can see assigned rides." ON public.rides FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own location." ON public.drivers FOR UPDATE USING (auth.uid() = id);
