/* =========================================================
   RUN THIS SQL in Supabase SQL Editor:
   https://supabase.com/dashboard/project/frxidigxcxtehybcoaez/sql/new
   ========================================================= */
const SQL = `
-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT REFERENCES properties(id),
  user_email TEXT DEFAULT '',
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'usd',
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  status TEXT DEFAULT 'pending',
  type TEXT DEFAULT 'deposit',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "payments_read" ON payments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "payments_insert" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "payments_update" ON payments FOR UPDATE USING (true);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "settings_read" ON settings FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "settings_write" ON settings FOR ALL USING (true);
INSERT INTO settings (key, value) VALUES ('bank_info', '{}') ON CONFLICT (key) DO NOTHING;
`;
console.log('Copy the SQL above. Open this URL in your browser:');
console.log('https://supabase.com/dashboard/project/frxidigxcxtehybcoaez/sql/new');
console.log('Paste the SQL and click "Run"');
console.log('\n' + SQL);
