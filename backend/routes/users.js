const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const router = express.Router();

function authToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM site_users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO site_users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);

  const token = jwt.sign({ id: result.lastInsertRowid, email, name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id: result.lastInsertRowid, name, email } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM site_users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

router.get('/me', authToken, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, created_at FROM site_users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.get('/favorites', authToken, (req, res) => {
  const db = getDb();
  const favs = db.prepare(`
    SELECT p.* FROM favorites f
    JOIN properties p ON p.id = f.property_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);
  res.json(favs.map(p => ({ ...p, featured: !!p.featured })));
});

router.post('/favorites/:propertyId', authToken, (req, res) => {
  const db = getDb();
  const prop = db.prepare('SELECT id FROM properties WHERE id = ?').get(req.params.propertyId);
  if (!prop) return res.status(404).json({ error: 'Property not found' });

  try {
    db.prepare('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)').run(req.user.id, req.params.propertyId);
    res.json({ favorited: true });
  } catch {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND property_id = ?').run(req.user.id, req.params.propertyId);
    res.json({ favorited: false });
  }
});

router.get('/favorites/ids', authToken, (req, res) => {
  const db = getDb();
  const ids = db.prepare('SELECT property_id FROM favorites WHERE user_id = ?').all(req.user.id).map(r => r.property_id);
  res.json(ids);
});

module.exports = router;
