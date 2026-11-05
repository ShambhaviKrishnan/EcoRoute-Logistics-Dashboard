export type VehicleType = 'Electric' | 'Hybrid' | 'Diesel'
export type VehicleStatus = 'Active' | 'Maintenance' | 'Idle'

export interface Vehicle {
  id: string
  name: string
  type: VehicleType
  status: VehicleStatus
  battery_level: number
  current_lat: number
  current_lng: number
  current_payload_kg: number
}

export interface WeatherResponse {
  condition: string
  delay_modifier: number
  temperature_c?: number
  wind_kph?: number
  coordinates: {
    lat: number
    lng: number
  }
}

export interface OptimizeRouteRequest {
  origin: string
  destination: string
  weight_kg: number
}

export interface OptimizeRouteResponse {
  origin: string
  destination: string
  weight_kg: number
  distance_km: number
  estimated_time_mins: number
  carbon_emissions_kg: number
  recommended_vehicle_type: VehicleType
  eco_score: number
  source?: 'server_cache' | 'live_network_compute'
}

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'VEH-101',
    name: 'EcoVan Alpha-01',
    type: 'Electric',
    status: 'Active',
    battery_level: 84,
    current_lat: 37.7749,
    current_lng: -122.4194,
    current_payload_kg: 620
  },
  {
    id: 'VEH-102',
    name: 'VoltFreight Prime-02',
    type: 'Electric',
    status: 'Active',
    battery_level: 68,
    current_lat: 37.7897,
    current_lng: -122.4014,
    current_payload_kg: 940
  },
  {
    id: 'VEH-103',
    name: 'HybridHaul Metro-03',
    type: 'Hybrid',
    status: 'Idle',
    battery_level: 92,
    current_lat: 37.7612,
    current_lng: -122.435,
    current_payload_kg: 0
  },
  {
    id: 'VEH-104',
    name: 'AeroTransit E-04',
    type: 'Electric',
    status: 'Maintenance',
    battery_level: 23,
    current_lat: 37.751,
    current_lng: -122.4121,
    current_payload_kg: 150
  },
  {
    id: 'VEH-105',
    name: 'TitanFreight HD-05',
    type: 'Diesel',
    status: 'Active',
    battery_level: 76,
    current_lat: 37.8044,
    current_lng: -122.2712,
    current_payload_kg: 2450
  }
]

let inMemoryVehicles: Vehicle[] = [...INITIAL_VEHICLES]
let dbInitialized = false

/**
 * Ensures the `vehicles` table exists and seeds the 5 realistic vehicles
 * if the table is empty. Gracefully falls back to in-memory seed records if D1 binding is absent.
 */
export async function ensureDatabaseSeeded(db?: D1Database): Promise<void> {
  if (!db) {
    return
  }

  if (dbInitialized) {
    return
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('Electric', 'Hybrid', 'Diesel')),
        status TEXT NOT NULL CHECK (status IN ('Active', 'Maintenance', 'Idle')),
        battery_level INTEGER NOT NULL CHECK (battery_level >= 0 AND battery_level <= 100),
        current_lat REAL NOT NULL,
        current_lng REAL NOT NULL,
        current_payload_kg INTEGER NOT NULL CHECK (current_payload_kg >= 0)
      )`
    )
    .run()

  const countRow = await db
    .prepare('SELECT COUNT(*) as count FROM vehicles')
    .first<{ count: number }>()

  const count = Number(countRow?.count ?? 0)
  if (count === 0) {
    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO vehicles (
        id, name, type, status, battery_level, current_lat, current_lng, current_payload_kg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )

    await db.batch(
      INITIAL_VEHICLES.map((v) =>
        insertStmt.bind(
          v.id,
          v.name,
          v.type,
          v.status,
          v.battery_level,
          v.current_lat,
          v.current_lng,
          v.current_payload_kg
        )
      )
    )
  }

  dbInitialized = true
}

export async function getAllVehicles(db?: D1Database): Promise<Vehicle[]> {
  if (!db) {
    return inMemoryVehicles
  }

  await ensureDatabaseSeeded(db)
  const { results } = await db
    .prepare(
      `SELECT
        id,
        name,
        type,
        status,
        battery_level,
        current_lat,
        current_lng,
        current_payload_kg
      FROM vehicles
      ORDER BY id ASC`
    )
    .all<Vehicle>()

  return (results ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    type: row.type as VehicleType,
    status: row.status as VehicleStatus,
    battery_level: Number(row.battery_level),
    current_lat: Number(row.current_lat),
    current_lng: Number(row.current_lng),
    current_payload_kg: Number(row.current_payload_kg)
  }))
}
