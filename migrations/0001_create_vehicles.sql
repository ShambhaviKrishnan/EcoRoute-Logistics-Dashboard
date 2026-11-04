-- EcoRoute: Vehicles schema
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Electric', 'Hybrid', 'Diesel')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Maintenance', 'Idle')),
  battery_level INTEGER NOT NULL CHECK (battery_level >= 0 AND battery_level <= 100),
  current_lat REAL NOT NULL,
  current_lng REAL NOT NULL,
  current_payload_kg INTEGER NOT NULL CHECK (current_payload_kg >= 0)
);

-- Seed 5 realistic delivery vehicle records upon initialization
INSERT OR IGNORE INTO vehicles (id, name, type, status, battery_level, current_lat, current_lng, current_payload_kg) VALUES
  ('VEH-101', 'EcoVan Alpha-01', 'Electric', 'Active', 84, 37.7749, -122.4194, 620),
  ('VEH-102', 'VoltFreight Prime-02', 'Electric', 'Active', 68, 37.7897, -122.4014, 940),
  ('VEH-103', 'HybridHaul Metro-03', 'Hybrid', 'Idle', 92, 37.7612, -122.4350, 0),
  ('VEH-104', 'AeroTransit E-04', 'Electric', 'Maintenance', 23, 37.7510, -122.4121, 150),
  ('VEH-105', 'TitanFreight HD-05', 'Diesel', 'Active', 76, 37.8044, -122.2712, 2450);
