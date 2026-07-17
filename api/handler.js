const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const Stripe = require('stripe');
const bcrypt = require('bcryptjs');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const rpName = 'Primenest Admin';
const CHALLENGE_SECRET = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'opencode-fallback-key';

function signChallenge(challenge) {
  return crypto.createHmac('sha256', CHALLENGE_SECRET).update(challenge).digest('hex');
}

function getRpId(req) {
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host || 'localhost'}`;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://alisina-nu.vercel.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function emailLayout(title, bodyContent, color) {
  const gradient = color === 'admin' ? 'linear-gradient(135deg,#1e3a5f,#2563eb)' : 'linear-gradient(135deg,#0d9488,#14b8a6)';
  const icon = color === 'admin' ? '&#128196;' : '&#9989;';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="background:${gradient};padding:32px 40px;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">${icon}</div>
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600">${title}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;color:#334155;font-size:15px;line-height:1.6">
          ${bodyContent}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:13px">
          Primenest Reality &bull; All rights reserved
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

async function sendRenewalEmail(prop) {
  const { data: gmailConfig } = await supabase.from('settings').select('value').eq('key', 'gmail_smtp').maybeSingle();
  const gmailUser = gmailConfig?.value?.email;
  const gmailPass = gmailConfig?.value?.appPassword;
  if (!gmailUser || !gmailPass) return false;

  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: gmailUser, pass: gmailPass } });

  const durationMonths = { '1month': 1, '6months': 6, '1year': 12 };
  const durationLabels = { '1month': '1 Month', '6months': '6 Months', '1year': '1 Year' };
  const months = durationMonths[prop.rental_duration] || 1;
  const rentedAt = new Date(prop.rented_at).getTime();
  const expiresAt = rentedAt + months * 30 * 24 * 60 * 60 * 1000;
  const expiresDate = new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const monthlyPrice = `$${(prop.price || 0).toLocaleString()}/mo`;

  const renewYesUrl = `${SITE_URL}/?renew=yes&property_id=${prop.id}`;
  const renewNoUrl = `${SITE_URL}/?renew=no&property_id=${prop.id}`;

  const toEmail = prop.renter_email;
  if (!toEmail) return false;

  const bodyContent = `
    <p style="margin:0 0 6px;color:#64748b;font-size:14px">Hi ${prop.renter_name || 'there'},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:15px">Your rental for <strong>${prop.title}</strong> is expiring on <strong>${expiresDate}</strong>.</p>
    <p style="margin:0 0 20px;color:#334155;font-size:15px">Would you like to re-rent this property? You can choose a new duration (1 Month, 6 Months, or 1 Year) and complete payment.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Property</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${prop.title}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Location</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${prop.location || ''}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Current Plan</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${durationLabels[prop.rental_duration] || prop.rental_duration}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Monthly Price</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;color:#2563eb;font-size:16px">${monthlyPrice}</td></tr>
      <tr><td style="padding:12px 0;color:#64748b;font-size:14px">Expires</td><td style="padding:12px 0;font-weight:600;text-align:right;color:#dc2626">${expiresDate}</td></tr>
    </table>
    <div style="text-align:center;margin:28px 0 8px">
      <a href="${renewYesUrl}" style="display:inline-block;padding:14px 32px;background-color:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;margin-right:12px">Yes, I want to re-rent</a>
      <a href="${renewNoUrl}" style="display:inline-block;padding:14px 32px;background-color:#6b7280;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600">No, thanks</a>
    </div>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:13px;text-align:center">If you don't respond, your rental will expire on ${expiresDate} and the property will be listed for rent again.</p>
  `;

  await t.sendMail({
    from: `"Primenest Reality" <${gmailUser}>`,
    to: toEmail,
    subject: `Your rental for ${prop.title} is expiring soon — Re-rent?`,
    html: emailLayout('Rental Renewal', bodyContent, 'tenant'),
  });
  return true;
}

async function getStripe() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'stripe_secret_key').maybeSingle();
  const secret = data?.value?.secret || process.env.STRIPE_SECRET_KEY || '';
  return secret ? new Stripe(secret) : null;
}

async function getStripeConfig() {
  const [pk, sk] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'stripe_publishable_key').maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'stripe_secret_key').maybeSingle(),
  ]);
  const pub = pk?.data?.value?.key || '';
  const hasSecret = !!(sk?.data?.value?.secret || process.env.STRIPE_SECRET_KEY);
  return { publishable_key: pub, configured: hasSecret };
}

async function getWebhookSecret() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'stripe_webhook_secret').maybeSingle();
  return data?.value?.secret || process.env.STRIPE_WEBHOOK_SECRET || '';
}

function getBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (!req._rawBody) req._rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      return resolve(req.body);
    }
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      req._rawBody = Buffer.from(data);
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

async function getAuthUser(auth) {
  if (!auth) return null;
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token.startsWith('signed_')) return null;
  try {
    const rest = token.slice(7);
    const dotIdx = rest.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const encoded = rest.slice(0, dotIdx);
    const signature = rest.slice(dotIdx + 1);
    const payloadStr = Buffer.from(encoded, 'base64').toString();
    const payload = JSON.parse(payloadStr);
    if (payload.exp && Date.now() > payload.exp) return null;
    const secret = await getTokenSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;
    return payload;
  } catch { return null; }
}

async function checkRateLimit(key, maxRequests = 10, windowSec = 60) {
  const now = new Date();
  const { data } = await supabase.from('rate_limits').select('*').eq('key', key).maybeSingle();
  if (!data || new Date(data.expires_at) < now) {
    await supabase.from('rate_limits').upsert({ key, count: 1, expires_at: new Date(now.getTime() + windowSec * 1000).toISOString() }, { onConflict: 'key' });
    return true;
  }
  if (data.count >= maxRequests) return false;
  await supabase.from('rate_limits').update({ count: data.count + 1 }).eq('key', key);
  return true;
}

let _faceEngine = null;
async function getFaceEngine() {
  if (!_faceEngine) _faceEngine = require('./face-engine');
  return _faceEngine;
}

let _tokenSecret = null;
async function getTokenSecret() {
  if (_tokenSecret) return _tokenSecret;
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'token_secret').maybeSingle();
    if (data?.value?.secret) { _tokenSecret = data.value.secret; return _tokenSecret; }
  } catch {}
  if (process.env.JWT_SECRET) { _tokenSecret = process.env.JWT_SECRET; return _tokenSecret; }
  _tokenSecret = crypto.randomBytes(32).toString('hex');
  await supabase.from('settings').upsert({ key: 'token_secret', value: { secret: _tokenSecret }, updated_at: new Date().toISOString() }).catch(() => {});
  return _tokenSecret;
}

async function createSignedToken(payload) {
  const secret = await getTokenSecret();
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  return `signed_${encoded}.${signature}`;
}

module.exports = async (req, res) => {
  const allowedOrigins = [process.env.SITE_URL || 'https://alisina-nu.vercel.app'];
  const requestOrigin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api', '');
  const method = req.method;

  try {
    /* For webhook, get raw body for signature verification before Vercel parsing */
    if (path === '/payments/webhook' && method === 'POST') {
      let raw = '';
      req.on('data', chunk => raw += chunk);
      await new Promise(r => req.on('end', r));
      req._rawBody = Buffer.from(raw);
      try { req.body = JSON.parse(raw); } catch { req.body = {}; }
    }
    const body = await getBody(req);

    if (path === '/health' && method === 'GET') {
      return res.status(200).json({ status: 'ok' });
    }



    /* Property detail page (SEO) */
    const seoPropMatch = method === 'GET' && path.match(/^\/property\/(\d+)$/);
    if (seoPropMatch) {
      const id = parseInt(seoPropMatch[1]);
      const { data: p } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();
      if (!p) return res.status(404).setHeader('Content-Type', 'text/html').end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Property Not Found | Primenest Reality</title><link rel="stylesheet" href="/styles.css"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#1e293b;background:#f8fafc;text-align:center;padding:24px}h1{font-size:72px;margin:0;background:linear-gradient(135deg,#1e3a5f,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent}p{color:#64748b;margin:8px 0 24px}a{color:#2563eb}</style></head><body><div><h1>404</h1><p>Property not found</p><a href="/">Back to Home</a></div></body></html>');
      const price = p.badge === 'rent' ? `$${p.price.toLocaleString()}/mo` : `$${p.price.toLocaleString()}`;
      const desc = `${p.title} — ${p.beds} bed, ${p.baths} bath ${p.type} in ${p.location}. ${price}. Browse property details, photos, and more.`;
      const img = p.image || 'https://alisina-nu.vercel.app/images/alisina.jpg';
      const title = `${p.title} | Primenest Reality`;
      return res.status(200).setHeader('Content-Type', 'text/html').end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<meta name="description" content="${desc.replace(/"/g,'&quot;')}">
<meta property="og:title" content="${p.title}"><meta property="og:description" content="${desc.replace(/"/g,'&quot;')}"><meta property="og:image" content="${img}"><meta property="og:url" content="https://alisina-nu.vercel.app/property/${id}"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${p.title}"><meta name="twitter:description" content="${desc.replace(/"/g,'&quot;')}"><meta name="twitter:image" content="${img}">
<link rel="canonical" href="https://alisina-nu.vercel.app/property/${id}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"${p.title}","description":"${desc.replace(/"/g,'&quot;')}","image":"${img}","offers":{"@type":"Offer","priceCurrency":"USD","price":${p.price},"availability":"https://schema.org/InStock"}}</script>
<link rel="icon" type="image/jpeg" href="/images/logo.jpeg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WGYY6MVM5P"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-WGYY6MVM5P')</script>
</head><body>
<script>window.__propertyId=${id};</script>
<script src="/app.js"></script>
<script src="/config.js"></script>
</body></html>`);
    }

    /* Blog detail page (SEO) */
    const blogSlugMatch = method === 'GET' && path.match(/^\/blog\/(.+)$/) && (req.headers.accept || '').includes('text/html');
    if (blogSlugMatch) {
      const slug = decodeURIComponent(blogSlugMatch[1]);
      const { data: post } = await supabase.from('posts').select('*').eq('slug', slug).maybeSingle();
      if (!post) return res.status(404).setHeader('Content-Type', 'text/html').end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Post Not Found | Primenest Reality</title><link rel="stylesheet" href="/styles.css"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#1e293b;background:#f8fafc;text-align:center;padding:24px}h1{font-size:72px;margin:0;background:linear-gradient(135deg,#1e3a5f,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent}p{color:#64748b;margin:8px 0 24px}a{color:#2563eb}</style></head><body><div><h1>404</h1><p>Post not found</p><a href="/">Back to Home</a></div></body></html>');
      const img = post.image || 'https://alisina-nu.vercel.app/images/alisina.jpg';
      const postTitle = `${post.title} | Primenest Reality Blog`;
      const postDesc = (post.excerpt || post.content || '').replace(/<[^>]*>/g,'').substring(0,200).replace(/"/g,'&quot;');
      return res.status(200).setHeader('Content-Type', 'text/html').end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${postTitle}</title>
<meta name="description" content="${postDesc}">
<meta property="og:title" content="${post.title}"><meta property="og:description" content="${postDesc}"><meta property="og:image" content="${img}"><meta property="og:url" content="https://alisina-nu.vercel.app/blog/${slug}"><meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${post.title}"><meta name="twitter:description" content="${postDesc}"><meta name="twitter:image" content="${img}">
<link rel="canonical" href="https://alisina-nu.vercel.app/blog/${slug}">
<link rel="icon" type="image/jpeg" href="/images/logo.jpeg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WGYY6MVM5P"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-WGYY6MVM5P')</script>
</head><body>
<div class="container" style="max-width:720px;margin:40px auto;padding:0 24px">
<a href="/" style="color:#2563eb;text-decoration:none;margin-bottom:24px;display:inline-block">&larr; Back to Home</a>
${post.image ? `<img src="${post.image}" alt="${post.title}" style="width:100%;border-radius:12px;margin:16px 0 24px;max-height:400px;object-fit:cover">` : ''}
<h1 style="font-size:32px;margin-bottom:8px">${post.title}</h1>
<p style="color:#94a3b8;font-size:14px;margin-bottom:24px">${post.created_at?.split(' ')[0] || ''} &bull; By ${post.author || 'Primenest Reality'}</p>
<div style="font-size:16px;line-height:1.8;color:#334155">${post.content || ''}</div>
</div>
<script src="/app.js"></script>
<script src="/config.js"></script>
</body></html>`);
    }

    /* Properties */
    if (path === '/properties' && method === 'GET') {
      /* Lightweight auto-expire check on every public request */
      try {
        const { data: rentedProps } = await supabase.from('properties').select('id, rented_at, rental_duration').eq('status', 'rented').not('rented_at', 'is', null);
        if (rentedProps && rentedProps.length > 0) {
          const durationMonths = { '1month': 1, '6months': 6, '1year': 12 };
          const now = Date.now();
          const expiredIds = [];
          for (const p of rentedProps) {
            const months = durationMonths[p.rental_duration];
            if (!months || !p.rented_at) continue;
            const expiresAt = new Date(p.rented_at).getTime() + months * 30 * 24 * 60 * 60 * 1000;
            if (now >= expiresAt) expiredIds.push(p.id);
          }
          if (expiredIds.length > 0) {
            await supabase.from('properties').update({ status: 'available', updated_at: new Date().toISOString(), rented_at: null, rental_duration: '', renewal_email_sent: false, renter_email: '', renter_name: '' }).in('id', expiredIds);
          }
        }
      } catch (e) { console.error('Error:', e.message); }

      let query = supabase.from('properties').select('*');
      const type = url.searchParams.get('type');
      const badge = url.searchParams.get('badge');
      const search = url.searchParams.get('search');
      const minPrice = url.searchParams.get('minPrice');
      const maxPrice = url.searchParams.get('maxPrice');
      const sort = url.searchParams.get('sort');

      if (type) query = query.eq('type', type);
      if (badge) query = query.eq('badge', badge);
      if (search) query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);
      if (minPrice) query = query.gte('price', Number(minPrice));
      if (maxPrice) query = query.lte('price', Number(maxPrice));

      const sortMap = { price_asc: { column: 'price', ascending: true }, price_desc: { column: 'price', ascending: false }, newest: { column: 'created_at', ascending: false }, oldest: { column: 'created_at', ascending: true } };
      const s = sortMap[sort] || { column: 'created_at', ascending: false };
      query = query.order(s.column, { ascending: s.ascending });

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (path === '/properties/featured' && method === 'GET') {
      const { data, error } = await supabase.from('properties').select('*').eq('featured', true).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (path === '/properties' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('properties').delete().neq('id', 0);
      if (error) throw error;
      return res.status(200).json({ message: 'All properties deleted' });
    }

    const propMatch = path.match(/^\/properties\/(\d+)$/);
    if (propMatch && method === 'GET') {
      const { data, error } = await supabase.from('properties').select('*').eq('id', propMatch[1]).single();
      if (error) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(data);
    }

    if (propMatch && method === 'PUT') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const upd = { ...body, updated_at: new Date().toISOString() };
      for (const f of ['title_l10n','location_l10n','description_l10n']) {
        if (body[f] !== undefined) upd[f] = body[f];
      }
      const { error } = await supabase.from('properties').update(upd).eq('id', propMatch[1]);
      if (error) throw error;
      const { data } = await supabase.from('properties').select('*').eq('id', propMatch[1]).single();
      return res.status(200).json(data);
    }

    if (propMatch && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('properties').delete().eq('id', propMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    /* Cancel property status (admin: reset deposited/rented back to available) */
    const cancelStatusMatch = path.match(/^\/properties\/(\d+)\/cancel-status$/);
    if (cancelStatusMatch && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const propId = parseInt(cancelStatusMatch[1]);
      const { error } = await supabase.from('properties').update({ status: 'available', updated_at: new Date().toISOString(), rented_at: null, rental_duration: '', renewal_email_sent: false, renter_email: '', renter_name: '' }).eq('id', propId);
      if (error) throw error;
      const { data } = await supabase.from('properties').select('*').eq('id', propId).single();
      return res.status(200).json(data);
    }

    /* Send renewal email for a rented property (admin only) */
    const sendRenewalMatch = path.match(/^\/properties\/(\d+)\/send-renewal$/);
    if (sendRenewalMatch && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const propId = parseInt(sendRenewalMatch[1]);
      const { data: prop } = await supabase.from('properties').select('*').eq('id', propId).single();
      if (!prop) return res.status(404).json({ error: 'Property not found' });
      if (prop.status !== 'rented') return res.status(400).json({ error: 'Property is not rented' });
      if (!prop.renter_email) return res.status(400).json({ error: 'No renter email found for this property' });
      try {
        const sent = await sendRenewalEmail(prop);
        if (!sent) return res.status(500).json({ error: 'Failed to send email — check SMTP config' });
        await supabase.from('properties').update({ renewal_email_sent: true, updated_at: new Date().toISOString() }).eq('id', propId);
        return res.status(200).json({ success: true, message: `Renewal email sent to ${prop.renter_email}` });
      } catch (e) {
        console.error('Send renewal email error:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    /* Auto-expire rented properties whose duration has passed */
    if (path === '/properties/check-expired' && method === 'GET') {
      const { data: rented } = await supabase.from('properties').select('id, rented_at, rental_duration, renewal_email_sent, renter_email, renter_name, title, location, price').eq('status', 'rented').not('rented_at', 'is', null);
      if (!rented || rented.length === 0) return res.status(200).json({ expired: [], checked: 0 });
      const durationMonths = { '1month': 1, '6months': 6, '1year': 12 };
      const now = Date.now();
      const expired = [];
      const renewalEmailsSent = [];
      for (const p of rented) {
        const months = durationMonths[p.rental_duration];
        if (!months || !p.rented_at) continue;
        const rentedAt = new Date(p.rented_at).getTime();
        const expiresAt = rentedAt + months * 30 * 24 * 60 * 60 * 1000;
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        if (now >= expiresAt) {
          expired.push(p.id);
        } else if (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0 && !p.renewal_email_sent && p.renter_email) {
          try {
            const sent = await sendRenewalEmail(p);
            if (sent) {
              await supabase.from('properties').update({ renewal_email_sent: true }).eq('id', p.id);
              renewalEmailsSent.push(p.id);
            }
          } catch (e) {
            console.error(`Failed to send renewal email for property ${p.id}:`, e.message);
          }
        }
      }
      if (expired.length > 0) {
        await supabase.from('properties').update({ status: 'available', updated_at: new Date().toISOString(), rented_at: null, rental_duration: '', renewal_email_sent: false, renter_email: '', renter_name: '' }).in('id', expired);
      }
      return res.status(200).json({ expired, renewalEmailsSent, checked: rented.length });
    }

    if (path === '/properties' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabase.from('properties').insert({ ...body, gallery: body.gallery || [] }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    /* Blog */
    if (path === '/blog' && method === 'GET') {
      const published = url.searchParams.get('published');
      let query = supabase.from('posts').select('*');
      if (published !== '0') query = query.eq('published', true);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (path === '/blog' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('posts').delete().neq('id', 0);
      if (error) throw error;
      return res.status(200).json({ message: 'All posts deleted' });
    }

    const blogMatch = path.match(/^\/blog\/(\d+)$/);
    if (blogMatch && method === 'GET') {
      const { data, error } = await supabase.from('posts').select('*').eq('id', blogMatch[1]).single();
      if (error) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(data);
    }

    if (path === '/blog' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabase.from('posts').insert(body).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (blogMatch && method === 'PUT') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const upd = { ...body, updated_at: new Date().toISOString() };
      for (const f of ['title_l10n','excerpt_l10n','content_l10n']) {
        if (body[f] !== undefined) upd[f] = body[f];
      }
      const { error } = await supabase.from('posts').update(upd).eq('id', blogMatch[1]);
      if (error) throw error;
      const { data } = await supabase.from('posts').select('*').eq('id', blogMatch[1]).single();
      return res.status(200).json(data);
    }

    if (blogMatch && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('posts').delete().eq('id', blogMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    /* Testimonials */
    if (path === '/testimonials' && method === 'GET') {
      const published = url.searchParams.get('published');
      let query = supabase.from('testimonials').select('*');
      if (published !== '0') query = query.eq('published', true);
      const { data, error } = await query.order('display_order', { ascending: true }).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    const testimonialMatch = path.match(/^\/testimonials\/(\d+)$/);
    if (testimonialMatch && method === 'GET') {
      const { data, error } = await supabase.from('testimonials').select('*').eq('id', testimonialMatch[1]).single();
      if (error) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(data);
    }

    if (testimonialMatch && method === 'PUT') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const upd = { ...body, updated_at: new Date().toISOString() };
      for (const f of ['name_l10n','role_l10n','content_l10n']) {
        if (body[f] !== undefined) upd[f] = body[f];
      }
      const { error } = await supabase.from('testimonials').update(upd).eq('id', testimonialMatch[1]);
      if (error) throw error;
      const { data } = await supabase.from('testimonials').select('*').eq('id', testimonialMatch[1]).single();
      return res.status(200).json(data);
    }

    if (testimonialMatch && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('testimonials').delete().eq('id', testimonialMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    if (path === '/testimonials' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabase.from('testimonials').insert(body).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    /* Contact */
    if (path === '/contact' && method === 'POST') {
      const allowed = await checkRateLimit('contact_' + (body.email || 'unknown'), 3, 300);
      if (!allowed) return res.status(429).json({ error: 'Too many messages. Try again later.' });
      const { data, error } = await supabase.from('contacts').insert(body).select().single();
      if (error) throw error;
      /* Send email notification via Gmail SMTP */
      try {
        const { data: gmailConfig } = await supabase.from('settings').select('value').eq('key', 'gmail_smtp').maybeSingle();
        const { data: contactInfo } = await supabase.from('settings').select('value').eq('key', 'contact_info').maybeSingle();
        const gmailUser = gmailConfig?.value?.email;
        const gmailPass = gmailConfig?.value?.appPassword;
        const toEmail = contactInfo?.value?.email || gmailUser;
        if (gmailUser && gmailPass && toEmail) {
          const nodemailer = require('nodemailer');
          const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: gmailUser, pass: gmailPass } });
          await t.sendMail({
            from: `"Primenest Reality" <${gmailUser}>`,
            to: toEmail,
            subject: `New inquiry from ${body.name || 'Visitor'}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#2563eb;margin-bottom:16px">New Contact Inquiry</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">${body.name || ''}</td></tr>
                <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:${body.email || ''}">${body.email || ''}</a></td></tr>
                <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee">${body.phone || 'N/A'}</td></tr>
                <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Inquiry</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-transform:capitalize">${body.inquiry_type || ''}</td></tr>
                ${body.property ? `<tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Property</td><td style="padding:8px 0;border-bottom:1px solid #eee">${body.property}</td></tr>` : ''}
                <tr><td style="padding:8px 0;color:#666">Message</td><td style="padding:8px 0">${body.message || ''}</td></tr>
              </table>
              <p style="margin-top:20px;color:#999;font-size:12px">Reply directly to ${body.email || 'this visitor'} to respond.</p>
            </div>`
          });
        }
      } catch (e) { console.error('Contact email error:', e.message); }
      return res.status(200).json({ success: true, message: 'Message received' });
    }

    if (path === '/contact/messages' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('contacts').delete().neq('id', 0);
      if (error) throw error;
      return res.status(200).json({ message: 'All messages deleted' });
    }

    if (path === '/contact/messages' && method === 'GET') {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
      const from = (page - 1) * limit;
      const { data, error, count } = await supabase.from('contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + limit - 1);
      if (error) throw error;
      return res.status(200).json({ messages: data || [], total: count, page, pages: Math.ceil(count / limit) });
    }

    const msgDelMatch = path.match(/^\/contact\/messages\/(\d+)$/);
    if (msgDelMatch && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabase.from('contacts').delete().eq('id', msgDelMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    /* Auth */
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
      if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'Admin password not configured' });
      if (username === process.env.ADMIN_USERNAME || username === 'admin') {
        if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid credentials' });
        const token = await createSignedToken({ id: 1, username, role: 'admin', exp: Date.now() + 86400000 });
        return res.status(200).json({ token });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (path === '/auth/password' && method === 'PUT') {
      return res.status(200).json({ message: 'Password updated (static admin)' });
    }

    /* ─── WebAuthn ─── */

    const webauthnCheckMatch = method === 'GET' && path.match(/^\/auth\/webauthn\/check\/(.+)$/);
    if (webauthnCheckMatch) {
      const username = decodeURIComponent(webauthnCheckMatch[1]);
      const isAdmin = username === (process.env.ADMIN_USERNAME || 'admin');
      if (!isAdmin) return res.json({ hasPasskey: false });
      const { data: keys } = await supabase.from('webauthn_passkeys').select('id').eq('user_id', 1);
      return res.json({ hasPasskey: (keys || []).length > 0 });
    }

    if (path === '/auth/webauthn/register/begin' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const rpId = getRpId(req);

      const { data: existingKeys } = await supabase.from('webauthn_passkeys').select('*').eq('user_id', user.id);

      const opts = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userName: user.username || 'admin',
        userDisplayName: 'Admin',
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
        excludeCredentials: (existingKeys || []).map(k => ({
          id: k.credential_id,
          type: 'public-key',
        })),
      });

      return res.json({ ...opts, challengeToken: signChallenge(opts.challenge) });
    }

    if (path === '/auth/webauthn/register/complete' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      if (!body.challengeToken || signChallenge(body.challenge) !== body.challengeToken) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
      }
      const expectedChallenge = body.challenge;

      const origin = getOrigin(req);
      const rpId = getRpId(req);

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpId,
        });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      if (!verification.verified) {
        return res.status(400).json({ error: 'Registration verification failed' });
      }

      const { registrationInfo } = verification;
      const { credential } = registrationInfo;

      await supabase.from('webauthn_passkeys').insert({
        user_id: user.id,
        username: user.username || 'admin',
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        transports: JSON.stringify(credential.transports || []),
      });

      return res.json({ verified: true });
    }

    if (path === '/auth/webauthn/login/begin' && method === 'POST') {
      const { username } = body || {};

      const rpId = getRpId(req);

      let allowCredentials = [];
      if (username) {
        const isAdmin = username === (process.env.ADMIN_USERNAME || 'admin');
        if (!isAdmin) return res.status(404).json({ error: 'User not found' });
        const { data: keys } = await supabase.from('webauthn_passkeys').select('*').eq('username', username);
        if (!keys?.length) return res.status(404).json({ error: 'No passkey registered for this user' });
        allowCredentials = keys.map(k => ({
          id: k.credential_id,
          type: 'public-key',
        }));
      }

      const opts = await generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: username ? allowCredentials : [],
        userVerification: 'preferred',
      });

      const storeKey = username || 'any';

      return res.json({ ...opts, challengeToken: signChallenge(opts.challenge) });
    }

    if (path === '/auth/webauthn/login/complete' && method === 'POST') {
      if (!body.id || !body.response) return res.status(400).json({ error: 'Missing credential data' });

      const { data: keys } = await supabase.from('webauthn_passkeys').select('*');
      const stored = (keys || []).find(k => k.credential_id === body.id);
      if (!stored) return res.status(404).json({ error: 'Passkey not found' });

      if (!body.challengeToken || signChallenge(body.challenge || body.rawChallenge) !== body.challengeToken) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
      }
      const expectedChallenge = body.challenge || body.rawChallenge;

      const origin = getOrigin(req);
      const rpId = getRpId(req);

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: body,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpId,
          credential: {
            id: stored.credential_id,
            publicKey: Buffer.from(stored.public_key, 'base64'),
            counter: stored.counter,
            transports: JSON.parse(stored.transports || '[]'),
          },
        });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      if (!verification.verified) {
        return res.status(400).json({ error: 'Authentication verification failed' });
      }

      await supabase.from('webauthn_passkeys').update({ counter: verification.authenticationInfo.newCounter }).eq('id', stored.id);

      const token = await createSignedToken({ id: stored.user_id, username: stored.username, role: 'admin', exp: Date.now() + 86400000 });
      return res.json({ token, verified: true });
    }

    if (path === '/auth/webauthn/status' && method === 'GET') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data: passkeys } = await supabase.from('webauthn_passkeys').select('id, created_at').eq('user_id', user.id);
      return res.json({ passkeys: (passkeys || []).length, list: passkeys || [] });
    }

    if (path === '/auth/webauthn/passkeys' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      await supabase.from('webauthn_passkeys').delete().eq('user_id', user.id);
      return res.json({ message: 'Passkeys removed' });
    }

    /* ─── Face Login (face-api.js) ─── */

    if (path === '/auth/face/descriptor' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { images } = body;
      if (!Array.isArray(images) || images.length < 3 || images.length > 10) {
        return res.status(400).json({ error: 'Provide 3-10 face images' });
      }

      const embeddings = [];
      for (let i = 0; i < images.length; i++) {
        try {
          const { processImage } = await getFaceEngine();
          const result = await processImage(images[i]);
          embeddings.push(result.embedding);
        } catch (e) {
          return res.status(400).json({ error: `Image ${i + 1}: ${e.message}` });
        }
      }

      const { data: existing } = await supabase.from('face_data').select('user_id').eq('user_id', user.id).maybeSingle();
      if (existing) {
        await supabase.from('face_data').update({ face_descriptor: JSON.stringify(embeddings) }).eq('user_id', user.id);
      } else {
        await supabase.from('face_data').insert({ user_id: user.id, face_descriptor: JSON.stringify(embeddings) });
      }
      return res.json({ success: true, enrolled: embeddings.length });
    }

    if (path === '/auth/face/descriptor' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      await supabase.from('face_data').delete().eq('user_id', user.id);
      return res.json({ success: true });
    }

    if (path === '/auth/face/compare' && method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      const allowed = await checkRateLimit('face_login_' + ip, 30, 300);
      if (!allowed) return res.status(429).json({ error: 'Too many face login attempts. Try again later.' });

      const { image } = body;
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image data required' });
      }

      const { data: allFaces } = await supabase.from('face_data').select('*');
      if (!allFaces || allFaces.length === 0) return res.status(404).json({ error: 'No face enrolled' });

      const storedEmbeddings = [];
      const userMap = [];
      for (const row of allFaces) {
        let parsed;
        try { parsed = JSON.parse(row.face_descriptor); }
        catch { continue; }
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
          for (const emb of parsed) {
            storedEmbeddings.push(emb);
            userMap.push(row.user_id);
          }
        } else if (Array.isArray(parsed) && parsed.length === 128) {
          storedEmbeddings.push(parsed);
          userMap.push(row.user_id);
        }
      }

      if (storedEmbeddings.length === 0) {
        return res.status(404).json({ error: 'No valid face data found' });
      }

      let result;
      try {
        const { verifyImage } = await getFaceEngine();
        result = await verifyImage(image, storedEmbeddings);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      if (!result.match) {
        return res.status(401).json({ error: 'Face does not match', distance: result.distance });
      }

      const matchedUserId = userMap[result.best_index];
      const token = await createSignedToken({ id: matchedUserId, role: 'admin', exp: Date.now() + 86400000 });
      return res.json({ token, distance: result.distance, verified: true });
    }

    if (path === '/auth/face/status' && method === 'GET') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data } = await supabase.from('face_data').select('user_id').eq('user_id', user.id).maybeSingle();
      return res.json({ enrolled: !!data });
    }

    /* Upload */
    if (path === '/upload' && method === 'POST') {
      const { file, name } = body;
      if (!file || !name) return res.status(400).json({ error: 'file and name required' });
      const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
      const size = Buffer.byteLength(base64Data, 'base64');
      if (size > 3 * 1024 * 1024) return res.status(413).json({ error: 'File too large (max 3MB)' });
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === 'property-images')) {
        const { error: ce } = await supabase.storage.createBucket('property-images', { public: true });
        if (ce && !ce.message?.includes('already exists')) throw ce;
      }
      const filename = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: ue } = await supabase.storage.from('property-images').upload(filename, Buffer.from(base64Data, 'base64'), { contentType: file.split(';')[0].split(':')[1] || 'image/jpeg', upsert: false });
      if (ue) throw ue;
      const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(filename);
      return res.status(200).json({ url: publicUrl });
    }

    /* Stripe config (dynamic — admin sets keys in Settings) */
    if (path === '/stripe/config' && method === 'GET') {
      const cfg = await getStripeConfig();
      return res.status(200).json(cfg);
    }

    if (path === '/stripe/save' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { publishable_key, secret_key, webhook_secret } = body;
      const now = new Date().toISOString();
      await Promise.all([
        supabase.from('settings').upsert({ key: 'stripe_publishable_key', value: { key: publishable_key || '' }, updated_at: now }),
        supabase.from('settings').upsert({ key: 'stripe_secret_key', value: { secret: secret_key || '' }, updated_at: now }),
        supabase.from('settings').upsert({ key: 'stripe_webhook_secret', value: { secret: webhook_secret || '' }, updated_at: now }),
      ]);
      return res.status(200).json({ success: true });
    }

    /* Payments - Stripe Checkout */
    if (path === '/payments/create-checkout' && method === 'POST') {
      const stripe = await getStripe();
      if (!stripe) return res.status(503).json({ error: 'Payment not configured — admin must save Stripe keys in Settings' });
      const { property_id, type, email, duration } = body;
      if (!property_id || !type) return res.status(400).json({ error: 'property_id and type required' });
      const { data: property } = await supabase.from('properties').select('*').eq('id', property_id).single();
      if (!property) return res.status(404).json({ error: 'Property not found' });
      const durationMonths = { '1month': 1, '6months': 6, '1year': 12 };
      let amount;
      if (type === 'deposit') {
        amount = 1000;
      } else if (type === 'rent') {
        const months = durationMonths[duration] || 1;
        amount = property.price * months;
      } else {
        amount = null;
      }
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
      const rentDesc = type === 'rent' ? ` — ${duration || '1month'}` : '';
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: property.title, description: property.location + rentDesc }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
        mode: 'payment',
        success_url: `${SITE_URL}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}?payment=canceled`,
        metadata: { property_id: String(property_id), type, duration: duration || '1month' },
        ...(email ? { customer_email: email } : {}),
      });
      return res.status(200).json({ url: session.url });
    }

    if (path === '/payments/webhook' && method === 'POST') {
      const stripe = await getStripe();
      const whsec = await getWebhookSecret();
      if (!stripe || !whsec) return res.status(503).json({ error: 'Payment not configured' });
      const sig = req.headers['stripe-signature'];
      let event;
      try {
        event = stripe.webhooks.constructEvent(req._rawBody, sig, whsec);
      } catch {
        return res.status(400).json({ error: 'Invalid signature' });
      }
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { property_id, type, duration } = session.metadata || {};
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        let receiptUrl = '';
        try {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
          receiptUrl = pi.charges?.data[0]?.receipt_url || `https://dashboard.stripe.com/payments/${session.payment_intent}`;
        } catch (e) { console.error('Error:', e.message); }
        try {
          let insertData = {
            property_id: parseInt(property_id) || null,
            user_email: session.customer_details?.email || '',
            amount,
            currency: session.currency || 'usd',
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent || '',
            receipt_url: receiptUrl,
            customer_name: session.customer_details?.name || '',
            status: 'completed',
            type: type || 'deposit',
          };
          if (duration) insertData.duration = duration;
          let insertRes = await supabase.from('payments').insert(insertData).select();
          if (insertRes.error && insertRes.error.message?.includes('duration')) {
            delete insertData.duration;
            insertRes = await supabase.from('payments').insert(insertData).select();
          }
          if (insertRes.error) console.error('Webhook insert error:', insertRes.error?.code, insertRes.error?.message);
          /* Update property status to deposited/rented */
          if (property_id && type) {
            const newStatus = type === 'rent' ? 'rented' : 'deposited';
            const updateData = { status: newStatus, updated_at: new Date().toISOString() };
            if (type === 'rent' && duration) {
              updateData.rented_at = new Date().toISOString();
              updateData.rental_duration = duration;
              updateData.renter_email = session.customer_details?.email || '';
              updateData.renter_name = session.customer_details?.name || '';
              updateData.renewal_email_sent = false;
            }
            await supabase.from('properties').update(updateData).eq('id', parseInt(property_id));
          }
          /* Send email notifications */
          const { data: notif } = await supabase.from('settings').select('value').eq('key', 'notification_email').maybeSingle();
          const toEmail = notif?.value?.email;
          const { data: gmailConfig } = await supabase.from('settings').select('value').eq('key', 'gmail_smtp').maybeSingle();
          const gmailUser = gmailConfig?.value?.email;
          const gmailPass = gmailConfig?.value?.appPassword;
          const { data: prop } = await supabase.from('properties').select('title').eq('id', parseInt(property_id) || 0).maybeSingle();
          const propName = prop?.title || `Property #${property_id}`;
          const customerName = session.customer_details?.name || 'Valued Customer';
          const customerEmail = session.customer_details?.email || '';
          if (gmailUser && gmailPass && toEmail) {
            const nodemailer = require('nodemailer');
            const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: gmailUser, pass: gmailPass } });
            try {
              await t.sendMail({
                from: `"Primenest Reality" <${gmailUser}>`, to: toEmail,
                subject: `New payment received — ${propName}`,
                html: emailLayout('New Payment Received', `
                  <p style="margin:0 0 6px;color:#64748b;font-size:14px">A new payment has come through.</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Property</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${propName}</td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Amount</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;font-size:18px;color:#2563eb">$${amount.toLocaleString()}</td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Type</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;text-transform:capitalize">${type || 'deposit'}${duration ? ' (' + ({'1month':'1 Month','6months':'6 Months','1year':'1 Year'}[duration] || duration) + ')' : ''}</td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Customer</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${customerEmail || 'No email'}</td></tr>
                  </table>
                  <div style="text-align:center;margin:24px 0 8px"><a href="${receiptUrl}" style="display:inline-block;padding:12px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500">View Receipt</a></div>
                `, 'admin'),
              });
            } catch (e) { console.error('admin email error:', e.message); }
          } else {
            console.error('admin email skipped — missing config:', { gmailUser: !!gmailUser, gmailPass: !!gmailPass, toEmail: !!toEmail });
          }
        } catch (e) {
          console.error('Webhook insert error:', e?.code, e?.message);
        }
      }
      return res.status(200).json({ received: true });
    }

    if (path === '/payments' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { error } = await supabase.from('payments').delete().neq('id', 0);
        if (error) throw error;
        return res.status(200).json({ message: 'All payments deleted' });
      } catch (e) {
        if (e?.code === 'PGRST205') return res.status(200).json({ message: 'No payments table yet' });
        throw e;
      }
    }

    if (path === '/payments' && method === 'GET') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { data: payments, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const propertyIds = [...new Set((payments || []).map(p => p.property_id).filter(Boolean))];
        let propertyMap = {};
        if (propertyIds.length > 0) {
          const { data: props } = await supabase.from('properties').select('id, title, location').in('id', propertyIds);
          if (props) props.forEach(p => propertyMap[p.id] = { title: p.title, location: p.location });
        }
        return res.status(200).json((payments || []).map(p => ({ ...p, properties: propertyMap[p.property_id] || null })));
      } catch (e) {
        if (e?.code === 'PGRST205') return res.status(200).json([]);
        throw e;
      }
    }

    /* Manual resend payment notification email */
    const notifyMatch = path.match(/^\/payments\/(\d+)\/notify$/);
    if (notifyMatch && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const payId = parseInt(notifyMatch[1]);
      try {
        const { data: payment } = await supabase.from('payments').select('*').eq('id', payId).maybeSingle();
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        const { data: gmailConfig } = await supabase.from('settings').select('value').eq('key', 'gmail_smtp').maybeSingle();
        const gmailUser = gmailConfig?.value?.email;
        const gmailPass = gmailConfig?.value?.appPassword;
        const { data: notif } = await supabase.from('settings').select('value').eq('key', 'notification_email').maybeSingle();
        const toEmail = notif?.value?.email;
        if (!gmailUser || !gmailPass) return res.status(400).json({ error: 'Gmail SMTP not configured' });
        if (!toEmail) return res.status(400).json({ error: 'Notification email not configured' });
        const { data: prop } = await supabase.from('properties').select('title').eq('id', payment.property_id || 0).maybeSingle();
        const propName = prop?.title || `Property #${payment.property_id}`;
        const nodemailer = require('nodemailer');
        const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: gmailUser, pass: gmailPass } });
        await t.sendMail({
          from: `"Primenest Reality" <${gmailUser}>`, to: toEmail,
          subject: `Payment notification — ${propName}`,
          html: emailLayout('Payment Notification', `
            <p style="margin:0 0 6px;color:#64748b;font-size:14px">Payment details from your records.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
              <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Property</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${propName}</td></tr>
              <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Amount</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;font-size:18px;color:#2563eb">$${(payment.amount || 0).toLocaleString()}</td></tr>
              <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Type</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;text-transform:capitalize">${payment.type || 'deposit'}</td></tr>
              <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Customer</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${payment.customer_name || payment.user_email || 'N/A'}</td></tr>
              <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Date</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${new Date(payment.created_at).toLocaleDateString()}</td></tr>
            </table>
            ${payment.receipt_url ? `<div style="text-align:center;margin:24px 0 8px"><a href="${payment.receipt_url}" style="display:inline-block;padding:12px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500">View Receipt</a></div>` : ''}
          `, 'admin'),
        });
        return res.status(200).json({ success: true, message: `Email sent to ${toEmail}` });
      } catch (e) {
        console.error('resend notification error:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    if (path === '/payments/delete' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { id, ids } = body;
      if (ids && Array.isArray(ids)) {
        const { error } = await supabase.from('payments').delete().in('id', ids);
        if (error) throw error;
        return res.status(200).json({ message: `Deleted ${ids.length} payments` });
      }
      if (!id) return res.status(400).json({ error: 'id or ids required' });
      try {
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ message: 'Deleted' });
      } catch (e) {
        if (e?.code === 'PGRST205') return res.status(200).json({ message: 'No payments table yet' });
        throw e;
      }
    }

    /* Settings (Payments Settings) */
    if (path === '/payments/settings' && method === 'GET') {
      try {
        const key = url.searchParams.get('key') || 'bank_info';
        const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
        return res.status(200).json(data?.value || {});
      } catch { return res.status(200).json({}); }
    }

    if (path === '/payments/settings' && method === 'PUT') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { key, value, bank_name, account_name, account_number, routing, iban, swift } = body;
        let settingsKey = 'bank_info';
        let settingsValue = { bank_name, account_name, account_number, routing, iban, swift };
        if (key) {
          settingsKey = key;
          settingsValue = value;
        }
        const { error } = await supabase.from('settings').upsert({ key: settingsKey, value: settingsValue, updated_at: new Date().toISOString() });
        if (error) throw error;
        return res.status(200).json({ success: true });
      } catch (e) {
        if (e?.code === 'PGRST205') return res.status(200).json({ message: 'Settings table not ready, run migration SQL' });
        throw e;
      }
    }

    /* Contact Info Settings */
    if (path === '/settings/contact' && method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'contact_info').maybeSingle();
        return res.status(200).json(data?.value || {
          phone: '', email: '', address: '', whatsapp: '', whatsapp_message: 'Hi, I\'m interested in your properties',
          facebook_url: '', instagram_url: '', linkedin_url: '', formsubmit_email: ''
        });
      } catch { return res.status(200).json({}); }
    }

    if (path === '/settings/contact' && method === 'PUT') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { error } = await supabase.from('settings').upsert({ key: 'contact_info', value: body, updated_at: new Date().toISOString() });
        if (error) throw error;
        return res.status(200).json({ success: true });
      } catch (e) {
        if (e?.code === 'PGRST205') return res.status(200).json({ message: 'Settings table not ready' });
        throw e;
      }
    }

    /* Refund Payment */
    if (path === '/payments/refund' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { payment_id } = body;
      if (!payment_id) return res.status(400).json({ error: 'payment_id required' });
      try {
        const { data: payment, error: fetchErr } = await supabase.from('payments').select('*').eq('id', payment_id).single();
        if (fetchErr || !payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status !== 'completed') return res.status(400).json({ error: 'Payment not completed' });
        if (!payment.stripe_payment_intent) return res.status(400).json({ error: 'No Stripe payment intent' });
        const stripe = await getStripe();
        const refund = await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent });
        await supabase.from('payments').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', payment_id);
        return res.status(200).json({ success: true, refund_id: refund.id });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    /* Payment Summary per property */
    if (path === '/payments/summary' && method === 'GET') {
      try {
        const { data: payments } = await supabase.from('payments').select('property_id, amount, status').eq('status', 'completed');
        if (!payments) return res.status(200).json([]);
        const { data: props } = await supabase.from('properties').select('id, title, price, badge');
        if (!props) return res.status(200).json([]);
        const map = {};
        for (const p of payments) {
          const id = p.property_id;
          if (!id) continue;
          if (!map[id]) map[id] = 0;
          map[id] += parseFloat(p.amount) || 0;
        }
        const result = props.map(p => ({
          id: p.id, title: p.title, price: p.price, badge: p.badge,
          total_collected: map[p.id] || 0,
          balance: Math.max(0, (p.price || 0) - (map[p.id] || 0)),
        }));
        return res.status(200).json(result);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    /* Refund all completed payments (admin only — test mode cleanup) */
    if (path === '/payments/refund-all' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const { data: payments } = await supabase.from('payments').select('*').eq('status', 'completed').not('stripe_payment_intent', 'is', null);
        if (!payments?.length) return res.status(200).json({ message: 'No completed payments to refund' });
        const stripe = await getStripe();
        let refunded = 0;
        for (const p of payments) {
          try {
            await stripe.refunds.create({ payment_intent: p.stripe_payment_intent });
            await supabase.from('payments').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', p.id);
            refunded++;
          } catch (e) { console.error('Error:', e.message); }
        }
        return res.status(200).json({ message: `Refunded ${refunded} of ${payments.length} payments` });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    /* Email test endpoint (admin only) */
    if (path === '/payments/test-email' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { testEmail } = body;
      try {
        const { data: gmailConfig } = await supabase.from('settings').select('value').eq('key', 'gmail_smtp').maybeSingle();
        const gmailUser = gmailConfig?.value?.email;
        const gmailPass = gmailConfig?.value?.appPassword;
        if (!gmailUser || !gmailPass) return res.status(400).json({ error: 'Gmail not configured' });
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 587, secure: false,
          auth: { user: gmailUser, pass: gmailPass },
        });
        const info = await transporter.sendMail({
          from: `"Primenest Reality" <${gmailUser}>`,
          to: testEmail || gmailUser,
          subject: 'Test email from Vercel',
          html: '<p>This is a test — your Gmail SMTP is working!</p>',
        });
        return res.status(200).json({ success: true, messageId: info.messageId });
      } catch (e) {
        return res.status(500).json({ error: e.message, code: e.code });
      }
    }

    /* CSV import (admin only) */
    if (path === '/properties/import' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = await getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { csv } = body;
      if (!csv) return res.status(400).json({ error: 'CSV data required' });
      const rows = csv.split('\n').filter(r => r.trim());
      if (rows.length < 2) return res.status(400).json({ error: 'CSV must have header + at least 1 row' });
      const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
      const required = ['title', 'price'];
      for (const r of required) { if (!headers.includes(r)) return res.status(400).json({ error: `CSV missing required column: ${r}` }); }
      const imported = [];
      for (let i = 1; i < rows.length; i++) {
        const vals = rows[i].split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
        const prop = {
          title: obj.title,
          location: obj.location || obj.city || '',
          price: Number(obj.price) || 0,
          type: obj.type || 'house',
          beds: Number(obj.beds) || 0,
          baths: Number(obj.baths) || 0,
          sqft: Number(obj.sqft) || 0,
          year: Number(obj.year) || null,
          image: obj.image || obj.photo || '',
          badge: obj.badge || obj.status || 'sale',
          featured: obj.featured === 'true' || obj.featured === 'yes' || false,
          description: obj.description || '',
        };
        const { data, error } = await supabase.from('properties').insert(prop).select().single();
        if (!error && data) imported.push(data);
      }
      return res.status(200).json({ message: `Imported ${imported.length} properties`, count: imported.length });
    }

    return res.status(404).json({ error: 'Not found', path, method });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
