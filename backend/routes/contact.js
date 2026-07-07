const express = require('express');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', (req, res) => {
  const { name, email, phone, message, inquiry_type, property: prop } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO contacts (name, email, phone, inquiry_type, property, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, email, phone || '', inquiry_type || '', prop || '', message);

  res.json({ success: true, message: 'Message received. I\'ll get back to you soon.' });
});

router.post('/schedule', (req, res) => {
  const { name, email, phone, property: prop, date, time, notes } = req.body;
  if (!name || !email || !phone || !date || !time) {
    return res.status(400).json({ error: 'Name, email, phone, date, and time are required' });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO schedules (name, email, phone, property, date, time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, phone, prop || '', date, time, notes || '');

  res.json({ success: true, message: 'Viewing request sent! I\'ll confirm within 24 hours.' });
});

router.get('/messages', authMiddleware, (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const messages = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);

  res.json({ messages, total, page, pages: Math.ceil(total / limit) });
});

router.get('/schedules', authMiddleware, (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM schedules').get().count;
  const schedules = db.prepare('SELECT * FROM schedules ORDER BY date DESC, time DESC LIMIT ? OFFSET ?').all(limit, offset);

  res.json({ schedules, total, page, pages: Math.ceil(total / limit) });
});

module.exports = router;
