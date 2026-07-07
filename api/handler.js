const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
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

    return res.status(404).json({ error: 'Not found', path, method });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
