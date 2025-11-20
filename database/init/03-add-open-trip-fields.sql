-- Add quota tracking field to open_trips table
ALTER TABLE open_trips ADD COLUMN IF NOT EXISTS quota_remaining INTEGER DEFAULT 0;
ALTER TABLE open_trips ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- Update existing open_trips to set initial quota_remaining based on max_participants
UPDATE open_trips SET quota_remaining = max_participants WHERE quota_remaining = 0;

-- Add a booking_status field to bookings table to track booking status
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_status VARCHAR(50) DEFAULT 'pending';