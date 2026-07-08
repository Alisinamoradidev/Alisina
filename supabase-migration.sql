-- Run this entire file in Supabase SQL Editor (SQL Editor tab in left sidebar)

-- 1. Create tables
CREATE TABLE IF NOT EXISTS properties (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  price REAL NOT NULL,
  type TEXT NOT NULL,
  beds INTEGER DEFAULT 0,
  baths INTEGER DEFAULT 0,
  sqft INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  gallery JSONB DEFAULT '[]',
  badge TEXT DEFAULT 'sale',
  featured BOOLEAN DEFAULT FALSE,
  year INTEGER,
  lat REAL,
  lng REAL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  inquiry_type TEXT DEFAULT '',
  property TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  property TEXT DEFAULT '',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT DEFAULT '',
  content TEXT NOT NULL,
  image TEXT DEFAULT '',
  author TEXT DEFAULT 'Alisina Moradi',
  published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- 2. Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 3. Create policies (public read, authenticated write where needed)
CREATE POLICY "properties_read" ON properties FOR SELECT USING (true);
CREATE POLICY "properties_all" ON properties FOR ALL USING (true);

CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "contacts_read" ON contacts FOR SELECT USING (true);

CREATE POLICY "schedules_insert" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedules_read" ON schedules FOR SELECT USING (true);

CREATE POLICY "posts_read" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_all" ON posts FOR ALL USING (true);

CREATE POLICY "site_users_insert" ON site_users FOR INSERT WITH CHECK (true);
CREATE POLICY "site_users_read" ON site_users FOR SELECT USING (true);

CREATE POLICY "favorites_all" ON favorites FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT REFERENCES properties(id),
  user_email TEXT DEFAULT '',
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'usd',
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  status TEXT DEFAULT 'pending',
  type TEXT DEFAULT 'deposit',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_read" ON payments FOR SELECT USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "payments_update" ON payments FOR UPDATE USING (true);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_write" ON settings FOR ALL USING (true);

INSERT INTO settings (key, value) VALUES ('bank_info', '{}') ON CONFLICT (key) DO NOTHING;

-- 4. Seed properties
INSERT INTO properties (title, location, price, type, beds, baths, sqft, image, badge, featured, year, lat, lng, description) VALUES
('Modern Downtown Apartment', '123 Main St, New York, NY', 450000, 'apartment', 2, 2, 1200, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80', 'sale', TRUE, 2021, 40.7128, -74.006, 'This stylish apartment offers contemporary living in the heart of the city.'),
('Luxury Villa with Pool', '456 Ocean Dr, Miami, FL', 1200000, 'villa', 5, 4, 4200, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&q=80', 'sale', TRUE, 2023, 25.7617, -80.1918, 'Experience luxury living in this exquisite villa featuring Mediterranean architecture.'),
('Cozy Suburban House', '789 Oak Ln, Austin, TX', 320000, 'house', 3, 2, 1800, 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80', 'sale', TRUE, 2019, 30.2672, -97.7431, 'This stunning home features an open floor plan with abundant natural light.'),
('Downtown Studio Apartment', '321 Pine St, Seattle, WA', 1800, 'apartment', 1, 1, 600, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80', 'rent', FALSE, 2020, 47.6062, -122.3321, 'Cozy studio in the heart of downtown Seattle.'),
('Beachfront Condo', '555 Shore Dr, Los Angeles, CA', 680000, 'condo', 3, 2, 1500, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80', 'sale', TRUE, 2022, 34.0522, -118.2437, 'Beautifully maintained condo with resort-style amenities.'),
('Mountain View House', '777 Summit Rd, Denver, CO', 2500, 'house', 4, 3, 2400, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80', 'rent', FALSE, 2018, 39.7392, -104.9903, 'Beautiful mountain retreat with stunning views.'),
('Penthouse Suite', '999 Skyline Blvd, Chicago, IL', 2100000, 'condo', 4, 3, 3200, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80', 'sale', TRUE, 2024, 41.8781, -87.6298, 'Luxury penthouse with panoramic city views.'),
('Garden Apartment', '222 Green St, Portland, OR', 1400, 'apartment', 2, 1, 850, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80', 'rent', FALSE, 2017, 45.5152, -122.6784, 'Charming garden apartment in a quiet neighborhood.'),
('Colonial Family Home', '444 Maple Ave, Boston, MA', 575000, 'house', 4, 3, 2600, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80', 'sale', TRUE, 2016, 42.3601, -71.0589, 'Classic colonial home with modern updates.');

-- 5. Seed blog post
INSERT INTO posts (title, slug, excerpt, content, image, author, published) VALUES
('2026 Real Estate Market Trends', '2026-real-estate-market-trends',
'Discover the key trends shaping the real estate market in 2026.',
'<p>The real estate market in 2026 continues to evolve with several key trends:</p><ul><li><strong>Interest Rates:</strong> Rates are stabilizing, creating opportunities.</li><li><strong>Suburban Growth:</strong> Families moving to suburban areas.</li><li><strong>Smart Homes:</strong> Properties with smart tech command premium prices.</li></ul><p>Contact me for a personalized market analysis!</p>',
'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&q=80', 'Alisina Moradi', TRUE);
