# EcoRoute — Enterprise Logistics & Fleet Optimization

## Project Overview
- **Name**: EcoRoute (`webapp`)
- **Goal**: Full-stack Logistics & Fleet Optimization web application powered by Hono, Cloudflare D1 (SQLite), React 18, Tailwind CSS, and Lucide React.
- **Public Sandbox Preview**: https://3000-ivddlkikftx1j97orpc7p-de59bda9.sandbox.novita.ai

## Completed Features
1. **Backend Database & Auto-Seed (`src/db.ts`, `migrations/0001_create_vehicles.sql`)**:
   - `vehicles` schema with `id`, `name`, `type` (`Electric`, `Hybrid`, `Diesel`), `status` (`Active`, `Maintenance`, `Idle`), `battery_level` (`0-100`), `current_lat`, `current_lng`, and `current_payload_kg`.
   - Automatic startup seeding of 5 realistic delivery vehicles (`VEH-101` to `VEH-105`).
2. **REST API Endpoints (`src/index.tsx`)**:
   - `GET /api/vehicles`: Fetches all fleet vehicle records from the database.
   - `GET /api/weather?lat=x&lng=y`: Computes local weather condition and `delay_modifier` based on GPS coordinates.
   - `POST /api/optimize-route`: Computes `distance_km`, `estimated_time_mins`, `carbon_emissions_kg`, `recommended_vehicle_type`, and `eco_score` with a 5-minute (`300,000 ms`) server-side in-memory cache (`source: "server_cache"` vs `"live_network_compute"`).
3. **Enterprise Dark-Themed Frontend Dashboard (`public/static/app.js`)**:
   - **Sidebar Navigation**: Fixed left sidebar switching smoothly across `'Live Fleet Status'`, `'Route Efficiency Calculator'`, and `'Carbon Analytics Hub'`.
   - **Tab 1 — Live Fleet Status**: Fetches `/api/vehicles` on mount, renders responsive vehicle cards with color-coded status badges (green for Active, yellow for Idle, red for Maintenance), visual battery progress bars, payload status, and a manual `'Refresh Fleet Data'` button.
   - **Tab 2 — Route Efficiency Calculator**: Interactive form for Origin, Destination, and Cargo Weight (kg) connected to `POST /api/optimize-route`, displaying Travel Distance, Estimated Duration, Recommended Vehicle Type, and dynamic source alert boxes (green alert for `server_cache`, blue alert for `live_network_compute`).
   - **Tab 3 — Carbon Analytics Hub**: High-end enterprise ESG & sustainability analytics displaying fleet electrification share, average active emissions, powertrain distribution bars, and decarbonization benchmarks.
