const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const router = express.Router();

const rpName = 'Alisina Admin';

function getRpId(req) {
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host || 'localhost'}`;
}

const challengeStore = new Map();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

router.put('/password', require('../middleware/auth'), (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

/* ─── WebAuthn Registration ─── */

router.post('/webauthn/register/begin', require('../middleware/auth'), (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rpId = getRpId(req);
    const existing = db.prepare('SELECT credential_id FROM passkeys WHERE user_id = ?').all(user.id);
    const excludeCredentials = existing.map(pk => ({ id: pk.credential_id, type: 'public-key' }));

    const options = generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userID: String(user.id),
      userName: user.username,
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials,
    });

    challengeStore.set(user.id, options.challenge);
    res.json(options);
  } catch (err) {
    console.error('webauthn register begin error:', err);
    res.status(500).json({ error: 'Failed to start registration' });
  }
});

router.post('/webauthn/register/complete', require('../middleware/auth'), (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const expectedChallenge = challengeStore.get(user.id);
    if (!expectedChallenge) return res.status(400).json({ error: 'No registration challenge found. Try again.' });

    const rpId = getRpId(req);
    const origin = getOrigin(req);

    const verification = verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      challengeStore.delete(user.id);
      return res.status(400).json({ error: 'Registration verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const transports = req.body.response?.transports || [];

    db.prepare('INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)').run(
      user.id,
      credential.id,
      Buffer.from(credential.publicKey).toString('base64'),
      credential.counter,
      JSON.stringify(transports)
    );

    challengeStore.delete(user.id);
    res.json({ verified: true });
  } catch (err) {
    console.error('webauthn register complete error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/* ─── WebAuthn Authentication ─── */

router.post('/webauthn/login/begin', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const passkeys = db.prepare('SELECT * FROM passkeys WHERE user_id = ?').all(user.id);
    if (passkeys.length === 0) return res.status(404).json({ error: 'No passkey registered for this user' });

    const allowCredentials = passkeys.map(pk => ({
      id: pk.credential_id,
      type: 'public-key',
      transports: JSON.parse(pk.transports || '[]'),
    }));

    const rpId = getRpId(req);
    const options = generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    challengeStore.set(`auth_${user.id}`, { challenge: options.challenge, userId: user.id });
    res.json(options);
  } catch (err) {
    console.error('webauthn login begin error:', err);
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

router.post('/webauthn/login/complete', (req, res) => {
  try {
    const credentialId = req.body.id;
    if (!credentialId) return res.status(400).json({ error: 'Credential ID required' });

    const db = getDb();
    const stored = db.prepare('SELECT * FROM passkeys WHERE credential_id = ?').get(credentialId);
    if (!stored) return res.status(404).json({ error: 'Passkey not found' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(stored.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const challengeData = challengeStore.get(`auth_${user.id}`);
    if (!challengeData) return res.status(400).json({ error: 'No authentication challenge found. Try again.' });

    const rpId = getRpId(req);
    const origin = getOrigin(req);

    const verification = verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: stored.credential_id,
        publicKey: Buffer.from(stored.public_key, 'base64'),
        counter: stored.counter,
        transports: JSON.parse(stored.transports || '[]'),
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication verification failed' });
    }

    db.prepare('UPDATE passkeys SET counter = ? WHERE id = ?').run(verification.authenticationInfo.newCounter, stored.id);
    challengeStore.delete(`auth_${user.id}`);

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, verified: true });
  } catch (err) {
    console.error('webauthn login complete error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/webauthn/status', require('../middleware/auth'), (req, res) => {
  const db = getDb();
  const passkeys = db.prepare('SELECT id, created_at FROM passkeys WHERE user_id = ?').all(req.user.id);
  res.json({ passkeys: passkeys.length, list: passkeys });
});

router.get('/webauthn/check/:username', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.json({ hasPasskey: false });
  const count = db.prepare('SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?').get(user.id);
  res.json({ hasPasskey: count.c > 0 });
});

router.delete('/webauthn/passkeys', require('../middleware/auth'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM passkeys WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Passkeys removed' });
});

module.exports = router;
