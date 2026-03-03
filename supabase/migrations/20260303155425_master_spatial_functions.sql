-- Función avanzada para encontrar conductores cercanos optimizada con PostGIS
CREATE OR REPLACE FUNCTION get_nearby_drivers(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INT DEFAULT 5000,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  distance_meters FLOAT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  bearing FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    ST_Distance(d.current_location, ST_SetSRID(ST_Point(lng, lat), 4326)::geography) as distance_meters,
    ST_Y(d.current_location::geometry) as current_lat,
    ST_X(d.current_location::geometry) as current_lng,
    d.bearing
  FROM drivers d
  JOIN profiles p ON d.id = p.id
  WHERE d.status = 'online'
    AND ST_DWithin(d.current_location, ST_SetSRID(ST_Point(lng, lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC
  LIMIT max_results;
END;
$$;
