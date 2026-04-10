CREATE TABLE IF NOT EXISTS booking_leads (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  pickup_location TEXT NOT NULL,
  drop_location TEXT NOT NULL,
  trip_notes TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
