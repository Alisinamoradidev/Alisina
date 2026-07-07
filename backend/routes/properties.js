const express = require('express');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function serialize(property) {
  if (!property) return null;
  return {
    ...property,
    featured: !!property.featured,
  };
}

function serializeMany(properties) {
  return properties.map(serialize);
}

router.get('/', (req, res) => {
  const db = getDb();
  const properties = db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
  res.json(serializeMany(properties));
});

router.get('/featured', (req, res) => {
  const db = getDb();
  const properties = db.prepare('SELECT * FROM properties WHERE featured = 1 ORDER BY created_at DESC').all();
  res.json(serializeMany(properties));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(serialize(property));
});

router.post('/', authMiddleware, (req, res) => {
  const { title, location, price, type, beds, baths, sqft, image, badge, featured, year, lat, lng, description } = req.body;
  if (!title || !location || !price || !type) {
    return res.status(400).json({ error: 'Title, location, price, and type are required' });
  }

  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO properties (title, location, price, type, beds, baths, sqft, image, badge, featured, year, lat, lng, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    title, location, price, type,
    beds || 0, baths || 0, sqft || 0,
    image || '', badge || 'sale', featured ? 1 : 0,
    year || null, lat || null, lng || null,
    description || ''
  );

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serialize(property));
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  const { title, location, price, type, beds, baths, sqft, image, badge, featured, year, lat, lng, description } = req.body;

  db.prepare(`
    UPDATE properties SET
      title = COALESCE(?, title),
      location = COALESCE(?, location),
      price = COALESCE(?, price),
      type = COALESCE(?, type),
      beds = COALESCE(?, beds),
      baths = COALESCE(?, baths),
      sqft = COALESCE(?, sqft),
      image = COALESCE(?, image),
      badge = COALESCE(?, badge),
      featured = COALESCE(?, featured),
      year = COALESCE(?, year),
      lat = COALESCE(?, lat),
      lng = COALESCE(?, lng),
      description = COALESCE(?, description),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null, location ?? null, price ?? null, type ?? null,
    beds ?? null, baths ?? null, sqft ?? null,
    image ?? null, badge ?? null,
    featured !== undefined ? (featured ? 1 : 0) : null,
    year ?? null, lat ?? null, lng ?? null,
    description ?? null,
    req.params.id
  );

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json(serialize(property));
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ message: 'Property deleted' });
});

module.exports = router;
