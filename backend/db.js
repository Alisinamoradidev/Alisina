const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    migrate();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS site_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      price REAL NOT NULL,
      type TEXT NOT NULL,
      beds INTEGER NOT NULL DEFAULT 0,
      baths INTEGER NOT NULL DEFAULT 0,
      sqft INTEGER NOT NULL DEFAULT 0,
      image TEXT DEFAULT '',
      gallery TEXT DEFAULT '[]',
      badge TEXT NOT NULL DEFAULT 'sale',
      featured INTEGER NOT NULL DEFAULT 0,
      year INTEGER,
      lat REAL,
      lng REAL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      inquiry_type TEXT DEFAULT '',
      property TEXT DEFAULT '',
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      property TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT DEFAULT '',
      content TEXT NOT NULL,
      image TEXT DEFAULT '',
      author TEXT DEFAULT 'Alisina Moradi',
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      UNIQUE(user_id, property_id)
    );
  `);

  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }
}

function migrate() {
  const cols = db.prepare("PRAGMA table_info('properties')").all().map(c => c.name);
  if (!cols.includes('gallery')) {
    try { db.prepare("ALTER TABLE properties ADD COLUMN gallery TEXT DEFAULT '[]'").run(); } catch {}
  }
  if (!cols.includes('description')) {
    try { db.prepare("ALTER TABLE properties ADD COLUMN description TEXT DEFAULT ''").run(); } catch {}
  }

  const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
  if (propCount === 0) seedData();
}

function seedData() {
  const props = [
    { t: "Modern Downtown Apartment", l: "123 Main St, New York, NY", p: 450000, tp: "apartment", b: 2, ba: 2, s: 1200, i: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80", bd: "sale", f: 1, y: 2021, la: 40.7128, ln: -74.006, d: "This stylish apartment offers contemporary living in the heart of the city." },
    { t: "Luxury Villa with Pool", l: "456 Ocean Dr, Miami, FL", p: 1200000, tp: "villa", b: 5, ba: 4, s: 4200, i: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&q=80", bd: "sale", f: 1, y: 2023, la: 25.7617, ln: -80.1918, d: "Experience luxury living in this exquisite villa featuring Mediterranean architecture." },
    { t: "Cozy Suburban House", l: "789 Oak Ln, Austin, TX", p: 320000, tp: "house", b: 3, ba: 2, s: 1800, i: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80", bd: "sale", f: 1, y: 2019, la: 30.2672, ln: -97.7431, d: "This stunning home features an open floor plan with abundant natural light." },
    { t: "Downtown Studio Apartment", l: "321 Pine St, Seattle, WA", p: 1800, tp: "apartment", b: 1, ba: 1, s: 600, i: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80", bd: "rent", f: 0, y: 2020, la: 47.6062, ln: -122.3321, d: "Cozy studio in the heart of downtown Seattle." },
    { t: "Beachfront Condo", l: "555 Shore Dr, Los Angeles, CA", p: 680000, tp: "condo", b: 3, ba: 2, s: 1500, i: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80", bd: "sale", f: 1, y: 2022, la: 34.0522, ln: -118.2437, d: "Beautifully maintained condo with resort-style amenities." },
    { t: "Mountain View House", l: "777 Summit Rd, Denver, CO", p: 2500, tp: "house", b: 4, ba: 3, s: 2400, i: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80", bd: "rent", f: 0, y: 2018, la: 39.7392, ln: -104.9903, d: "Beautiful mountain retreat with stunning views." },
    { t: "Penthouse Suite", l: "999 Skyline Blvd, Chicago, IL", p: 2100000, tp: "condo", b: 4, ba: 3, s: 3200, i: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80", bd: "sale", f: 1, y: 2024, la: 41.8781, ln: -87.6298, d: "Luxury penthouse with panoramic city views." },
    { t: "Garden Apartment", l: "222 Green St, Portland, OR", p: 1400, tp: "apartment", b: 2, ba: 1, s: 850, i: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80", bd: "rent", f: 0, y: 2017, la: 45.5152, ln: -122.6784, d: "Charming garden apartment in a quiet neighborhood." },
    { t: "Colonial Family Home", l: "444 Maple Ave, Boston, MA", p: 575000, tp: "house", b: 4, ba: 3, s: 2600, i: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80", bd: "sale", f: 1, y: 2016, la: 42.3601, ln: -71.0589, d: "Classic colonial home with modern updates." }
  ];
  const stmt = db.prepare('INSERT INTO properties (title, location, price, type, beds, baths, sqft, image, gallery, badge, featured, year, lat, lng, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const p of props) stmt.run(p.t, p.l, p.p, p.tp, p.b, p.ba, p.s, p.i, '[]', p.bd, p.f, p.y, p.la, p.ln, p.d);

  db.prepare("INSERT INTO posts (title, slug, excerpt, content, image, author, published) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    '2026 Real Estate Market Trends', '2026-real-estate-market-trends',
    'Discover the key trends shaping the real estate market in 2026.',
    '<p>The real estate market in 2026 continues to evolve with several key trends:</p><ul><li><strong>Interest Rates:</strong> Rates are stabilizing, creating opportunities.</li><li><strong>Suburban Growth:</strong> Families moving to suburban areas.</li><li><strong>Smart Homes:</strong> Properties with smart tech command premium prices.</li></ul><p>Contact me for a personalized market analysis!</p>',
    'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&q=80', 'Alisina Moradi', 1
  );
}

module.exports = { getDb };
