# Primenest Reality — Client Setup Guide

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Local development |
| Vercel CLI | Latest | `npm i -g vercel` |
| Vercel Account | — | Hosting & serverless functions |
| Supabase Account | — | PostgreSQL database |
| Stripe Account | — | Payments (optional) |

---

## 2. Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview):

| Variable | Description | How to get |
|----------|-------------|------------|
| `ADMIN_USERNAME` | Admin login username | Choose any username |
| `ADMIN_PASSWORD` | Admin login password | **Change this immediately!** |
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API → `service_role` key |
| `SITE_URL` | Your deployed site URL | e.g. `https://your-project.vercel.app` |
| `JWT_SECRET` | Random string for token signing | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | Stripe secret API key | Stripe Dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe Dashboard → Developers → Webhooks → select your endpoint → Signing secret |

**Local development:** Copy the values into `.env.local` (never commit this file).

---

## 3. Database Setup

1. Create a new project in [Supabase](https://supabase.com)
2. Go to **SQL Editor** (left sidebar)
3. Paste the entire contents of `supabase-migration.sql` and run it

This creates:

| Table | Purpose |
|-------|---------|
| `properties` | All property listings |
| `contacts` | Contact form submissions |
| `posts` | Blog posts |
| `payments` | Payment records |
| `settings` | App config (bank info, payment, email) |
| `testimonials` | Client reviews |
| `subscribers` | Newsletter subscribers |
| `rate_limits` | API rate limiting |

**RLS policies** restrict public access. The service role key (set via `SUPABASE_SERVICE_KEY`) bypasses RLS for admin operations.

---

## 4. First Login

1. Deploy to Vercel (or run `vercel dev` locally)
2. Navigate to `/admin`
3. Log in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you set
4. Configure in order:
   1. **Contact Info** — Settings tab → fill in your business details
   2. **Payment Settings** — Settings → Payments → enter Stripe keys (or bank info for manual payments)
   3. **Email Notifications** — Settings → Email → enter Gmail SMTP credentials (app password, not regular password)
   4. **Add your first property** — Properties tab → Add

---

## 5. Admin Panel Features

| Tab | What it does |
|-----|-------------|
| **Properties** | Add, edit, delete listings. Bulk import via CSV. Mark as sale/rent. Track status (available/deposited/rented). |
| **Blog** | Create and publish posts with rich HTML content, featured images, and excerpts. |
| **Testimonials** | Manage client reviews with star ratings, display order, and publish toggle. |
| **Contact Messages** | View inquiries from the website contact form. |
| **Payments** | View payment history, process refunds, send payment notification emails. Track deposits and rentals. |
| **Settings** | Contact info, Stripe/bank payment config, Gmail SMTP email setup, Google Analytics ID, deposit amount. |

---

## 6. Customization

### Site Name & Branding
Edit `config.js` → `SITE_CONFIG`:
```js
const SITE_CONFIG = {
  name: 'Primenest Reality',
  tagline: 'Find Your Dream Home',
  phone: '+1-555-0123',
  email: 'info@primenest.com',
  address: '123 Main St, New York, NY 10001',
  analyticsId: '',        // Google Analytics ID
  depositAmount: 1000,    // Deposit amount in USD
};
```

### Colors & Theme
Edit CSS variables in `styles.css` → `:root`:
```css
:root {
  --primary: #1a73e8;
  --accent: #34a853;
  --dark: #1f2937;
  --bg: #f5e6d3;
  /* ... */
}
```
Dark mode variables are under `[data-theme="dark"]`.

### Images to Replace
| File | Purpose |
|------|---------|
| `images/logo.jpeg` | Site logo (header & footer) |
| `images/alisina.jpg` | Agent/profile photo |
| `images/icon-192.jpeg` | PWA icon (small) |
| `images/icon-512.jpeg` | PWA icon (large) |

---

## 7. CSV Import Format

Use **Properties → Import CSV** with these columns:

| Column | Required | Example | Notes |
|--------|----------|---------|-------|
| `title` | Yes | `Modern Apartment` | |
| `location` | Yes | `123 Main St, New York, NY` | |
| `price` | Yes | `450000` | Sale price or monthly rent |
| `type` | Yes | `apartment` | `apartment`, `house`, `villa`, `condo` |
| `beds` | No | `2` | Default: 0 |
| `baths` | No | `2` | Default: 0 |
| `sqft` | No | `1200` | Default: 0 |
| `year` | No | `2021` | Build year |
| `image` | No | `https://...` | Image URL |
| `badge` | No | `sale` | `sale` or `rent` |
| `featured` | No | `TRUE` | `TRUE` or `FALSE` |
| `description` | No | `Beautiful unit...` | |

---

## 8. Security Notes

- **Never share your `ADMIN_PASSWORD`** — it's the only thing protecting your admin panel
- **Set `JWT_SECRET`** to a random string (32+ characters). Generate with the command in Section 2
- **`SUPABASE_SERVICE_KEY`** must stay secret — only set it in Vercel env vars, never commit it to code
- The **Supabase anon key** (in `config.js`) is safe to be public — Row Level Security (RLS) policies protect the data
- **Stripe webhook secret** — rotate it if compromised
- **Gmail SMTP** — use an App Password, not your regular Gmail password (Google Account → Security → 2FA → App passwords)
