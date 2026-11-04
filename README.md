# EcoRoute — Logistics & Fleet Optimization Backend

## Project Overview
- **Name**: EcoRoute (`webapp`)
- **Goal**: Full-stack Logistics & Fleet Optimization web application backend powered by Hono and SQLite/D1.
- **Completed Features**:
  - `vehicles` relational schema with constraints on `type` (`Electric`, `Hybrid`, `Diesel`), `status` (`Active`, `Maintenance`, `Idle`), `battery_level` (`0-100`), coordinates (`current_lat`, `current_lng`), and `current_payload_kg`.
  - Automatic startup database table initialization & seeding of 5 realistic delivery vehicles.
  - `GET /api/vehicles` endpoint returning all seeded fleet records.
  - `GET /api/weather?lat=x&lng=y` endpoint calculating weather conditions and `delay_modifier` values from coordinates.
  - `POST /api/optimize-route` endpoint computing `distance_km`, `estimated_time_mins`, and `carbon_emissions_kg` based on `origin`, `destination`, and `weight_kg`.

## API Entry URIs
- **`GET /api/vehicles`**: Fetches all vehicle statuses from the database.
- **`GET /api/weather?lat={lat}&lng={lng}`**: Returns `{ condition, delay_modifier, temperature_c, wind_kph, coordinates }`.
- **`POST /api/optimize-route`**: Accepts JSON `{ origin, destination, weight_kg }` and returns `{ origin, destination, weight_kg, distance_km, estimated_time_mins, carbon_emissions_kg, recommended_vehicle_type, eco_score }`.
