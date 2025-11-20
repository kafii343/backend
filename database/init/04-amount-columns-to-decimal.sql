-- database/init/04-amount-columns-to-decimal.sql
-- Update all amount-related columns from INTEGER to DECIMAL(12,2)

-- Update payments table
ALTER TABLE payments ALTER COLUMN amount TYPE DECIMAL(12,2) USING amount::DECIMAL;

-- Update bookings table
ALTER TABLE bookings ALTER COLUMN base_price TYPE DECIMAL(12,2) USING base_price::DECIMAL;
ALTER TABLE bookings ALTER COLUMN additional_services_price TYPE DECIMAL(12,2) USING additional_services_price::DECIMAL;
ALTER TABLE bookings ALTER COLUMN insurance_price TYPE DECIMAL(12,2) USING insurance_price::DECIMAL;
ALTER TABLE bookings ALTER COLUMN admin_fee TYPE DECIMAL(12,2) USING admin_fee::DECIMAL;
ALTER TABLE bookings ALTER COLUMN total_price TYPE DECIMAL(12,2) USING total_price::DECIMAL;

-- Update guides table
ALTER TABLE guides ALTER COLUMN price_per_day TYPE DECIMAL(12,2) USING price_per_day::DECIMAL;

-- Update porters table
ALTER TABLE porters ALTER COLUMN price_per_day TYPE DECIMAL(12,2) USING price_per_day::DECIMAL;

-- Update open_trips table
ALTER TABLE open_trips ALTER COLUMN base_price TYPE DECIMAL(12,2) USING base_price::DECIMAL;
ALTER TABLE open_trips ALTER COLUMN original_price TYPE DECIMAL(12,2) USING original_price::DECIMAL;

-- Add a new migration table to track applied migrations (optional)
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration
INSERT INTO schema_migrations (migration_name) 
VALUES ('04-amount-columns-to-decimal.sql') 
ON CONFLICT (migration_name) DO NOTHING;