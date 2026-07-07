const express = require('express');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function serialize(p) {
  if (!p) return null;
  let gallery = [];
  try { gallery = JSON.parse(p.gallery || '[]'); } catch {}
  return { ...p, featured: !!p.featured, gallery };
}

router.get('/', (req, res) => {
  const db = getDb();
  const { type, badge, minPrice, maxPrice, search, sort } = req.query;
  let sql = 'SELECT * FROM properties WHERE 1=1';
  const params = [];

  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (badge) { sql += ' AND badge = ?'; params.push(badge); }
  if (minPrice) { sql += ' AND price >= ?'; params.push(Number(minPrice)); }
  if (maxPrice) { sql += ' AND price <= ?'; params.push(Number(maxPrice)); }
  if (search) { sql += ' AND (title LIKE ? OR location LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const sortMap = { price_asc: 'price ASC', price_desc: 'price DESC', newest: 'created_at DESC', oldest: 'created_at ASC' };
  sql += ' ORDER BY ' + (sortMap[sort] || 'created_at DESC');

  const props = db.prepare(sql).all(...params);
  res.json(props.map(serialize));
});

router.get('/featured', (req, res) => {
  const db = getDb();
  const props = db.prepare('SELECT * FROM properties WHERE featured = 1 ORDER BY created_at DESC').all();
  res.json(props.map(serialize));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Property not found' });
  res.json(serialize(p));
});

router.post('/', authMiddleware, (req, res) => {
  const { title, location, price, type, beds, baths, sqft, image, gallery, badge, featured, year, lat, lng, description } = req.body;
  if (!title || !location || !price || !type) {
    return res.status(400).json({ error: 'Title, location, price, and type are required' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO properties (title, location, price, type, beds, baths, sqft, image, gallery, badge, featured, year, lat, lng, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, location, price, type,
    beds || 0, baths || 0, sqft || 0,
    image || '', JSON.stringify(gallery || []), badge || 'sale',
    featured ? 1 : 0, year || null, lat || null, lng || null,
    description || ''
  );

  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serialize(p));
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  const { title, location, price, type, beds, baths, sqft, image, gallery, badge, featured, year, lat, lng, description } = req.body;

  db.prepare(`
    UPDATE properties SET
      title = COALESCE(?, title), location = COALESCE(?, location),
      price = COALESCE(?, price), type = COALESCE(?, type),
      beds = COALESCE(?, beds), baths = COALESCE(?, baths),
      sqft = COALESCE(?, sqft), image = COALESCE(?, image),
      gallery = COALESCE(?, gallery), badge = COALESCE(?, badge),
      featured = COALESCE(?, featured), year = COALESCE(?, year),
      lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      description = COALESCE(?, description), updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null, location ?? null, price ?? null, type ?? null,
    beds ?? null, baths ?? null, sqft ?? null,
    image ?? null, gallery ? JSON.stringify(gallery) : null,
    badge ?? null, featured !== undefined ? (featured ? 1 : 0) : null,
    year ?? null, lat ?? null, lng ?? null,
    description ?? null, req.params.id
  );

  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json(serialize(p));
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ message: 'Property deleted' });
});

module.exports = router;
