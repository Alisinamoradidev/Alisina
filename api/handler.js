const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

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
          Alisina Realty &bull; All rights reserved
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
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

function getAuthUser(auth) {
  if (!auth) return null;
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token.startsWith('simple_')) return null;
  try {
    return JSON.parse(Buffer.from(token.replace('simple_', ''), 'base64').toString());
  } catch { return null; }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
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

    /* Properties */
    if (path === '/properties' && method === 'GET') {
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
      const { error } = await supabase.from('properties').update({ ...body, updated_at: new Date().toISOString() }).eq('id', propMatch[1]);
      if (error) throw error;
      const { data } = await supabase.from('properties').select('*').eq('id', propMatch[1]).single();
      return res.status(200).json(data);
    }

    if (propMatch && method === 'DELETE') {
      const { error } = await supabase.from('properties').delete().eq('id', propMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    if (path === '/properties' && method === 'POST') {
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
      const { data, error } = await supabase.from('posts').insert(body).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (blogMatch && method === 'PUT') {
      const { error } = await supabase.from('posts').update({ ...body, updated_at: new Date().toISOString() }).eq('id', blogMatch[1]);
      if (error) throw error;
      const { data } = await supabase.from('posts').select('*').eq('id', blogMatch[1]).single();
      return res.status(200).json(data);
    }

    if (blogMatch && method === 'DELETE') {
      const { error } = await supabase.from('posts').delete().eq('id', blogMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    /* Contact */
    if (path === '/contact' && method === 'POST') {
      const { data, error } = await supabase.from('contacts').insert(body).select().single();
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Message received' });
    }

    if (path === '/contact/schedule' && method === 'POST') {
      const { data, error } = await supabase.from('schedules').insert(body).select().single();
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Schedule saved' });
    }

    if (path === '/contact/messages' && method === 'DELETE') {
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
      const { error } = await supabase.from('contacts').delete().eq('id', msgDelMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    if (path === '/contact/schedules' && method === 'DELETE') {
      const { error } = await supabase.from('schedules').delete().neq('id', 0);
      if (error) throw error;
      return res.status(200).json({ message: 'All schedules deleted' });
    }

    if (path === '/contact/schedules' && method === 'GET') {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
      const from = (page - 1) * limit;
      const { data, error, count } = await supabase.from('schedules').select('*', { count: 'exact' }).order('date', { ascending: false }).range(from, from + limit - 1);
      if (error) throw error;
      return res.status(200).json({ schedules: data || [], total: count, page, pages: Math.ceil(count / limit) });
    }

    const schedDelMatch = path.match(/^\/contact\/schedules\/(\d+)$/);
    if (schedDelMatch && method === 'DELETE') {
      const { error } = await supabase.from('schedules').delete().eq('id', schedDelMatch[1]);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

    /* Auth */
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
      if (username === process.env.ADMIN_USERNAME || username === 'admin') {
        const pw = process.env.ADMIN_PASSWORD || 'admin123';
        if (password !== pw) return res.status(401).json({ error: 'Invalid credentials' });
        const token = Buffer.from(JSON.stringify({ id: 1, username, role: 'admin' })).toString('base64');
        return res.status(200).json({ token: `simple_${token}` });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (path === '/auth/password' && method === 'PUT') {
      return res.status(200).json({ message: 'Password updated (static admin)' });
    }

    /* Users */
    if (path === '/users/register' && method === 'POST') {
      const { name, email, password } = body;

      const { data: existing } = await supabase.from('site_users').select('id').eq('email', email).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const { data, error } = await supabase.from('site_users').insert({ name, email, password }).select().single();
      if (error) throw error;

      const token = Buffer.from(JSON.stringify({ id: data.id, email, name })).toString('base64');
      return res.status(201).json({ token: `simple_${token}`, user: { id: data.id, name, email } });
    }

    if (path === '/users/login' && method === 'POST') {
      const { email, password } = body;
      const { data: user } = await supabase.from('site_users').select('*').eq('email', email).maybeSingle();
      if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password' });

      const token = Buffer.from(JSON.stringify({ id: user.id, email: user.email, name: user.name })).toString('base64');
      return res.status(200).json({ token: `simple_${token}`, user: { id: user.id, name: user.name, email: user.email } });
    }

    if (path === '/users/me' && method === 'GET') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data } = await supabase.from('site_users').select('id, name, email, created_at').eq('id', user.id).single();
      if (data) return res.status(200).json(data);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    /* Favorites */
    if (path === '/users/favorites' && method === 'GET') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabase.from('favorites').select('property_id').eq('user_id', user.id);
      if (error) throw error;
      return res.status(200).json((data || []).map(f => f.property_id));
    }

    const favMatch = path.match(/^\/users\/favorites\/(\d+)$/);
    if (favMatch && method === 'POST') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const propId = parseInt(favMatch[1]);

      const { data: existing } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('property_id', propId).maybeSingle();

      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        return res.status(200).json({ favorited: false });
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, property_id: propId });
        return res.status(200).json({ favorited: true });
      }
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
      const user = getAuthUser(auth);
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
      const { property_id, type, email } = body;
      if (!property_id || !type) return res.status(400).json({ error: 'property_id and type required' });
      const { data: property } = await supabase.from('properties').select('*').eq('id', property_id).single();
      if (!property) return res.status(404).json({ error: 'Property not found' });
      const amount = type === 'deposit' ? 1000 : (type === 'rent' ? property.price : null);
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: property.title, description: property.location }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
        mode: 'payment',
        success_url: `${SITE_URL}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}?payment=canceled`,
        metadata: { property_id: String(property_id), type },
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
        const { property_id, type } = session.metadata || {};
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        let receiptUrl = '';
        try {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
          receiptUrl = pi.charges?.data[0]?.receipt_url || `https://dashboard.stripe.com/payments/${session.payment_intent}`;
        } catch {}
        try {
          await supabase.from('payments').insert({
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
          }).select();
          /* Send email notifications */
          const { data: notif } = await supabase.from('settings').select('value').eq('key', 'notification_email').maybeSingle();
          const toEmail = notif?.value?.email;
          const { data: gmailConfig } = await supabase.from('settings').select('value').eq('key', 'gmail_smtp').maybeSingle();
          const gmailUser = gmailConfig?.value?.email;
          const gmailPass = gmailConfig?.value?.appPassword;
          const { data: prop } = await supabase.from('properties').select('title').eq('id', parseInt(property_id) || 0).maybeSingle();
          const propName = prop?.title || `Property #${property_id}`;
          const customerName = session.customer_details?.name || 'Valued Customer';
          const customerEmail = session.customer_details?.email || metaEmail;
          if (gmailUser && gmailPass) {
            const nodemailer = require('nodemailer');
            const sends = [];
            /* Admin email via Gmail SMTP */
            if (toEmail) {
              const t = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
              sends.push(t.sendMail({
                from: `"Alisina Realty" <${gmailUser}>`, to: toEmail,
                subject: `New payment received — ${propName}`,
                html: emailLayout('New Payment Received', `
                  <p style="margin:0 0 6px;color:#64748b;font-size:14px">A new payment has come through.</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Property</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${propName}</td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Amount</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;font-size:18px;color:#2563eb">$${amount.toLocaleString()}</td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Type</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;text-transform:capitalize">${type || 'deposit'}</td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Customer</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${customerEmail || 'No email'}</td></tr>
                  </table>
                  <div style="text-align:center;margin:24px 0 8px"><a href="${receiptUrl}" style="display:inline-block;padding:12px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500">View Receipt</a></div>
                `, 'admin'),
              }).then(() => { console.log('admin email ok'); }).catch(e => { console.error('admin email:', e.message); }));
            }
            /* Customer email via Resend API (different delivery path) */
            if (customerEmail && customerEmail !== toEmail) {
              const { data: resendConfig } = await supabase.from('settings').select('value').eq('key', 'resend_api_key').maybeSingle();
              const resendKey = resendConfig?.value?.key;
              if (resendKey) {
                sends.push(fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: 'Alisina Realty <onboarding@resend.dev>',
                    to: [customerEmail],
                    subject: `Payment Confirmed — ${propName}`,
                    html: emailLayout('Payment Confirmed', `
                      <p style="margin:0 0 6px;color:#334155">Dear ${customerName},</p>
                      <p style="color:#64748b;font-size:14px">Your payment has been received successfully. Here are the details:</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
                        <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Property</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right">${propName}</td></tr>
                        <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Amount</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;font-size:18px;color:#14b8a6">$${amount.toLocaleString()}</td></tr>
                        <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">Type</td><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-weight:600;text-align:right;text-transform:capitalize">${type || 'deposit'}</td></tr>
                      </table>
                      <p style="color:#64748b;font-size:14px;margin:20px 0 0">Thank you for choosing us. If you have any questions, feel free to reply to this email.</p>
                    `, 'customer'),
                  }),
                }).then(async r => { const b = await r.text(); console.log('resend:', r.status, b); }).catch(e => { console.error('resend error:', e.message); }));
              } else {
                console.log('no resend key, skipping customer email');
              }
            }
            await Promise.allSettled(sends);
          }
        } catch (e) {
          console.error('Webhook insert error:', e?.code, e?.message);
        }
      }
      return res.status(200).json({ received: true });
    }

    if (path === '/payments' && method === 'DELETE') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
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
      const user = getAuthUser(auth);
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

    if (path === '/payments/delete' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
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
      const user = getAuthUser(auth);
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

    /* Refund Payment */
    if (path === '/payments/refund' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const { payment_id } = body;
      if (!payment_id) return res.status(400).json({ error: 'payment_id required' });
      try {
        const { data: payment, error: fetchErr } = await supabase.from('payments').select('*').eq('id', payment_id).single();
        if (fetchErr || !payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status !== 'completed') return res.status(400).json({ error: 'Payment not completed' });
        if (!payment.stripe_payment_intent) return res.status(400).json({ error: 'No Stripe payment intent' });
        const stripe = getStripe();
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

    /* TEMP test resend */
    if (path === '/payments/test-resend' && method === 'POST') {
      const { data: resendConfig } = await supabase.from('settings').select('value').eq('key', 'resend_api_key').maybeSingle();
      const resendKey = resendConfig?.value?.key;
      if (!resendKey) return res.status(400).json({ error: 'no resend key' });
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Alisina Realty <onboarding@resend.dev>', to: ['alisinam485@gmail.com'], subject: 'Test Resend', html: '<p>Test from Resend</p>' }),
      });
      const b = await r.text();
      return res.status(r.status).json({ status: r.status, body: b });
    }

    /* Email test endpoint (admin only) */
    if (path === '/payments/test-email' && method === 'POST') {
      const auth = req.headers.authorization;
      const user = getAuthUser(auth);
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
          from: `"Alisina Realty" <${gmailUser}>`,
          to: testEmail || gmailUser,
          subject: 'Test email from Vercel',
          html: '<p>This is a test — your Gmail SMTP is working!</p>',
        });
        return res.status(200).json({ success: true, messageId: info.messageId });
      } catch (e) {
        return res.status(500).json({ error: e.message, code: e.code });
      }
    }

    return res.status(404).json({ error: 'Not found', path, method });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
