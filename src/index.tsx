import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  ensureDatabaseSeeded,
  getAllVehicles,
  type OptimizeRouteRequest,
  type OptimizeRouteResponse,
  type VehicleType,
  type WeatherResponse
} from './db'

type Bindings = {
  DB?: D1Database
}

interface RouteCacheEntry {
  data: OptimizeRouteResponse
  timestamp: number
}

// 1. In-Memory Cache Store for route calculation results (5-minute TTL = 300,000 ms)
const ROUTE_CACHE_TTL_MS = 300_000
const routeOptimizationCache = new Map<string, RouteCacheEntry>()

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for all API routes
app.use('/api/*', cors())

// Global error handler returning standard JSON
app.onError((err, c) => {
  console.error('[EcoRoute Error]:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'An unexpected error occurred'
    },
    500
  )
})

// 404 handler for API routes
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`
    },
    404
  )
})

/**
 * GET /api/vehicles
 * Fetches all vehicle statuses from the database (seeds 5 realistic vehicles on startup if blank).
 */
app.get('/api/vehicles', async (c) => {
  try {
    await ensureDatabaseSeeded(c.env?.DB)
    const vehicles = await getAllVehicles(c.env?.DB)
    return c.json({
      success: true,
      count: vehicles.length,
      vehicles
    })
  } catch (err) {
    console.error('Error fetching vehicles:', err)
    return c.json(
      {
        success: false,
        error: 'Failed to retrieve vehicles from database',
        message: err instanceof Error ? err.message : 'Unknown database error'
      },
      500
    )
  }
})

/**
 * GET /api/weather?lat=x&lng=y
 * Calculates a deterministic/realistic mock weather status response based on coordinates.
 * Example response: { condition: "Clear", delay_modifier: 1.0, ... }
 */
app.get('/api/weather', (c) => {
  const latParam = c.req.query('lat')
  const lngParam = c.req.query('lng')

  if (latParam === undefined || lngParam === undefined || latParam.trim() === '' || lngParam.trim() === '') {
    return c.json(
      {
        success: false,
        error: 'Missing required query parameters: lat and lng'
      },
      400
    )
  }

  const lat = Number(latParam)
  const lng = Number(lngParam)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return c.json(
      {
        success: false,
        error: 'Invalid coordinates. Provide valid numeric lat (-90 to 90) and lng (-180 to 180).'
      },
      400
    )
  }

  // Standard server-side JavaScript calculation based on coordinate hash
  const coordSeed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453)
  const bucket = Math.floor((coordSeed % 1) * 100)

  const weatherPresets: Array<{
    condition: string
    delay_modifier: number
    temperature_c: number
    wind_kph: number
  }> = [
    { condition: 'Clear', delay_modifier: 1.0, temperature_c: 21, wind_kph: 12 },
    { condition: 'Partly Cloudy', delay_modifier: 1.05, temperature_c: 18, wind_kph: 18 },
    { condition: 'Light Rain', delay_modifier: 1.15, temperature_c: 14, wind_kph: 24 },
    { condition: 'Dense Fog', delay_modifier: 1.25, temperature_c: 11, wind_kph: 9 },
    { condition: 'Heavy Rain', delay_modifier: 1.35, temperature_c: 12, wind_kph: 38 },
    { condition: 'Severe Storm', delay_modifier: 1.5, temperature_c: 9, wind_kph: 54 }
  ]

  let selected = weatherPresets[0]
  if (bucket < 40) {
    selected = weatherPresets[0] // Clear
  } else if (bucket < 62) {
    selected = weatherPresets[1] // Partly Cloudy
  } else if (bucket < 78) {
    selected = weatherPresets[2] // Light Rain
  } else if (bucket < 88) {
    selected = weatherPresets[3] // Dense Fog
  } else if (bucket < 96) {
    selected = weatherPresets[4] // Heavy Rain
  } else {
    selected = weatherPresets[5] // Severe Storm
  }

  const response: WeatherResponse = {
    condition: selected.condition,
    delay_modifier: selected.delay_modifier,
    temperature_c: selected.temperature_c,
    wind_kph: selected.wind_kph,
    coordinates: {
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4))
    }
  }

  return c.json(response)
})

/**
 * POST /api/optimize-route
 * Accepts { origin, destination, weight_kg } and computes an optimized route response
 * including distance_km, estimated_time_mins, and carbon_emissions_kg based on payload weight.
 */
app.post('/api/optimize-route', async (c) => {
  let body: Partial<OptimizeRouteRequest>
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      {
        success: false,
        error: 'Invalid JSON payload. Expected { origin, destination, weight_kg }.'
      },
      400
    )
  }

  const origin = typeof body.origin === 'string' ? body.origin.trim() : ''
  const destination = typeof body.destination === 'string' ? body.destination.trim() : ''
  const weightKg = Number(body.weight_kg)

  if (!origin || !destination) {
    return c.json(
      {
        success: false,
        error: 'Both "origin" and "destination" must be non-empty strings.'
      },
      400
    )
  }

  if (body.weight_kg === undefined || body.weight_kg === null || !Number.isFinite(weightKg) || weightKg < 0) {
    return c.json(
      {
        success: false,
        error: '"weight_kg" must be a valid non-negative number.'
      },
      400
    )
  }

  // 2. Unique Cache Key Structure: `${origin.trim().toLowerCase()}-${destination.trim().toLowerCase()}-${weight_kg}`
  const cacheKey = `${origin.trim().toLowerCase()}-${destination.trim().toLowerCase()}-${weightKg}`
  const now = Date.now()
  const cachedEntry = routeOptimizationCache.get(cacheKey)

  // 3. Validation & TTL (Time-To-Live: 5 minutes / 300,000 ms)
  if (cachedEntry && now - cachedEntry.timestamp < ROUTE_CACHE_TTL_MS) {
    return c.json({
      ...cachedEntry.data,
      source: 'server_cache'
    })
  }

  // Compute deterministic route distance from origin/destination strings
  const routeKey = `${origin.toLowerCase()}->${destination.toLowerCase()}`
  let hash = 0
  for (let i = 0; i < routeKey.length; i++) {
    hash = (hash * 31 + routeKey.charCodeAt(i)) >>> 0
  }

  // Realistic urban/regional logistics distance between 8.5 km and 145.0 km
  const baseDistanceKm = 8.5 + (hash % 1365) / 10
  const distance_km = Number(baseDistanceKm.toFixed(1))

  // Average fleet speed ~48 km/h + loading/weight handling factor
  const speedKmh = 48
  const baseMinutes = (distance_km / speedKmh) * 60
  const weightDelayMins = Math.min(35, weightKg * 0.008)
  const estimated_time_mins = Math.max(5, Math.round(baseMinutes + weightDelayMins))

  // Recommend vehicle type based on payload weight
  let recommended_vehicle_type: VehicleType = 'Electric'
  if (weightKg > 2000) {
    recommended_vehicle_type = 'Diesel'
  } else if (weightKg > 1000) {
    recommended_vehicle_type = 'Hybrid'
  }

  // Carbon emissions calculation (kg CO2e) factoring in distance and payload weight_kg
  // Base emission factor (kg CO2 per km) + load factor (kg CO2 per ton-km)
  const baseEmissionPerKm =
    recommended_vehicle_type === 'Electric'
      ? 0.045
      : recommended_vehicle_type === 'Hybrid'
        ? 0.145
        : 0.265

  const loadFactorPerKgKm = 0.000085
  const rawEmissions = distance_km * (baseEmissionPerKm + weightKg * loadFactorPerKgKm)
  const carbon_emissions_kg = Number(rawEmissions.toFixed(2))

  // Eco efficiency score (0-100)
  const eco_score = Math.max(
    45,
    Math.min(
      99,
      Math.round(
        recommended_vehicle_type === 'Electric'
          ? 96 - weightKg * 0.005
          : recommended_vehicle_type === 'Hybrid'
            ? 82 - weightKg * 0.004
            : 65 - weightKg * 0.003
      )
    )
  )

  const computedPayload: OptimizeRouteResponse = {
    origin,
    destination,
    weight_kg: weightKg,
    distance_km,
    estimated_time_mins,
    carbon_emissions_kg,
    recommended_vehicle_type,
    eco_score
  }

  // Store computed result alongside fresh timestamp in the server-side cache Map
  routeOptimizationCache.set(cacheKey, {
    data: computedPayload,
    timestamp: now
  })

  return c.json({
    ...computedPayload,
    source: 'live_network_compute'
  })
})

// Root route serving the EcoRoute React + Tailwind CSS + Lucide React Enterprise Dashboard
app.get('/', async (c) => {
  await ensureDatabaseSeeded(c.env?.DB)
  return c.html(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EcoRoute — Enterprise Logistics & Fleet Optimization</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
        "lucide-react": "https://esm.sh/lucide-react@0.460.0?external=react"
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
  <div id="root"></div>
  <script type="module" src="/static/app.js"></script>
</body>
</html>`)
})

export default app
