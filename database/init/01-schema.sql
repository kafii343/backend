-- database/init/01-schema.sql
-- Carten'z Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: Users (Pengguna Web)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'customer',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Guides (Team Guide)
-- ============================================
CREATE TABLE guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    experience_years INTEGER NOT NULL,
    rating DECIMAL(2,1) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    languages TEXT[],
    specialties TEXT[],
    price_per_day INTEGER NOT NULL,
    avatar_url TEXT,
    description TEXT,
    achievements TEXT[],
    is_verified BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Porters (Team Porter)
-- ============================================
CREATE TABLE porters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    experience_years INTEGER NOT NULL,
    rating DECIMAL(2,1) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    max_capacity_kg INTEGER NOT NULL,
    specialties TEXT[],
    price_per_day INTEGER NOT NULL,
    avatar_url TEXT,
    description TEXT,
    achievements TEXT[],
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Mountains (Destinasi Gunung)
-- ============================================
CREATE TABLE mountains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    altitude INTEGER,
    difficulty VARCHAR(50),
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Open Trips (Paket Open Trip)
-- ============================================
CREATE TABLE open_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    mountain_id UUID REFERENCES mountains(id),
    duration_days INTEGER NOT NULL,
    duration_nights INTEGER NOT NULL,
    difficulty VARCHAR(50),
    base_price INTEGER NOT NULL,
    original_price INTEGER,
    min_participants INTEGER DEFAULT 1,
    max_participants INTEGER NOT NULL,
    description TEXT,
    image_url TEXT,
    includes TEXT[],
    highlights TEXT[],
    itinerary JSONB,
    rating DECIMAL(2,1) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Open Trip Schedules
-- ============================================
CREATE TABLE open_trip_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    open_trip_id UUID REFERENCES open_trips(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    current_participants INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Bookings (Pemesanan)
-- ============================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    service_type VARCHAR(50) NOT NULL,
    open_trip_id UUID REFERENCES open_trips(id),
    mountain_id UUID REFERENCES mountains(id),
    guide_id UUID REFERENCES guides(id),
    porter_id UUID REFERENCES porters(id),
    
    -- Customer Info
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    emergency_contact VARCHAR(20) NOT NULL,
    address TEXT,
    
    -- Trip Details
    start_date DATE NOT NULL,
    end_date DATE,
    duration VARCHAR(50),
    total_participants INTEGER NOT NULL,
    
    -- Additional Services
    need_porter BOOLEAN DEFAULT FALSE,
    need_documentation BOOLEAN DEFAULT FALSE,
    need_equipment BOOLEAN DEFAULT FALSE,
    need_transport BOOLEAN DEFAULT FALSE,
    
    -- Special Requests
    dietary_requirements TEXT,
    medical_conditions TEXT,
    special_requests TEXT,
    
    -- Pricing
    base_price INTEGER NOT NULL,
    additional_services_price INTEGER DEFAULT 0,
    insurance_price INTEGER DEFAULT 0,
    admin_fee INTEGER DEFAULT 0,
    total_price INTEGER NOT NULL,
    
    -- Payment
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_invoice_url TEXT,
    payment_external_id VARCHAR(255),
    paid_at TIMESTAMP,
    
    -- Booking Status
    status VARCHAR(50) DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Reviews (Ulasan)
-- ============================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    user_id UUID REFERENCES users(id),
    guide_id UUID REFERENCES guides(id),
    porter_id UUID REFERENCES porters(id),
    open_trip_id UUID REFERENCES open_trips(id),
    
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    images TEXT[],
    
    is_verified BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: Payments (Detail Pembayaran)
-- ============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    external_id VARCHAR(255),
    invoice_url TEXT,
    amount INTEGER NOT NULL,
    payment_method VARCHAR(50),
    payment_channel VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    paid_at TIMESTAMP,
    expired_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_date ON bookings(start_date);
CREATE INDEX idx_open_trips_mountain ON open_trips(mountain_id);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guides_updated_at 
    BEFORE UPDATE ON guides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_porters_updated_at 
    BEFORE UPDATE ON porters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();