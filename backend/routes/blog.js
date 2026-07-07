const express = require('express');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const publishedOnly = req.query.published !== '0';
  const sql = publishedOnly
    ? "SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC"
    : "SELECT * FROM posts ORDER BY created_at DESC";
  const posts = db.prepare(sql).all();
  res.json(posts);
});

router.get('/:slug', (req, res) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/', authMiddleware, (req, res) => {
  const { title, slug, excerpt, content, image, author, published } = req.body;
  if (!title || !slug || !content) {
    return res.status(400).json({ error: 'Title, slug, and content are required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
  if (existing) return res.status(409).json({ error: 'A post with this slug already exists' });

  const result = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, content, image, author, published)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, slug, excerpt || '', content, image || '', author || 'Alisina Moradi', published !== undefined ? (published ? 1 : 0) : 1);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const { title, slug, excerpt, content, image, author, published } = req.body;

  if (slug && slug !== existing.slug) {
    const slugExists = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, req.params.id);
    if (slugExists) return res.status(409).json({ error: 'Slug already in use' });
  }

  db.prepare(`
    UPDATE posts SET
      title = COALESCE(?, title),
      slug = COALESCE(?, slug),
      excerpt = COALESCE(?, excerpt),
      content = COALESCE(?, content),
      image = COALESCE(?, image),
      author = COALESCE(?, author),
      published = COALESCE(?, published),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null, slug ?? null, excerpt ?? null, content ?? null,
    image ?? null, author ?? null,
    published !== undefined ? (published ? 1 : 0) : null,
    req.params.id
  );

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(post);
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Post deleted' });
});

module.exports = router;
