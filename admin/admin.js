const API = window.location.origin;
let token = localStorage.getItem('admin_token');
const ADMIN_PAGE_SIZE = 10;
let adminPageData = {}; /* { viewName: { items, page, totalPages } } */

function adminPaginate(view, items) {
  const key = view;
  if (!adminPageData[key]) adminPageData[key] = { page: 1 };
  const state = adminPageData[key];
  const totalPages = Math.ceil(items.length / ADMIN_PAGE_SIZE);
  if (state.page > totalPages) state.page = totalPages || 1;
  const page = state.page;
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  const pageItems = items.slice(start, start + ADMIN_PAGE_SIZE);
  const info = document.getElementById(`pageInfo_${view}`);
  if (info) info.textContent = items.length ? `Page ${page} of ${totalPages} (${items.length} total)` : '';
  const prevBtn = document.getElementById(`prevPage_${view}`);
  const nextBtn = document.getElementById(`nextPage_${view}`);
  if (prevBtn) { prevBtn.disabled = page <= 1; prevBtn.onclick = () => { adminPageData[key].page--; adminViewChanged(view); }; }
  if (nextBtn) { nextBtn.disabled = page >= totalPages; nextBtn.onclick = () => { adminPageData[key].page++; adminViewChanged(view); }; }
  return pageItems;
}
function adminViewChanged(view) {
  if (view === 'Properties') loadProperties();
  else if (view === 'Blog') loadPosts();
  else if (view === 'Payments') loadPayments();
  else if (view === 'Testimonials') loadTestimonials();
}

/* Helper: capitalize first letter */
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* Build the full l10n JSONB object from EN fields */
function buildFullL10n(store, prefix, suffix, fields) {
  const obj = {};
  for (const f of fields) {
    const el = document.getElementById(prefix + cap(f));
    if (el && el.value) obj[f] = { en: el.value, fa: '' };
  }
  return obj;
}

function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API}${path}${path.includes('?') ? '&' : '?'}_t=${Date.now()}`, { ...options, headers, cache: 'no-store' }).then(async r => {
    if (r.status === 401 && !path.includes('/auth/login')) { localStorage.removeItem('admin_token'); token = null; showLogin(); throw new Error('Session expired'); }
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Server error (${r.status}). Please try again.`); }
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

async function uploadImage(input, targetId, append) {
  const files = input.files;
  if (!files || files.length === 0) return;
  input.disabled = true;
  const el = document.getElementById(targetId);
  for (const file of files) {
    if (file.size > 3 * 1024 * 1024) { alert(`"${file.name}" too large (max 3MB), skipped`); continue; }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api('/api/upload', { method: 'POST', body: JSON.stringify({ file: data, name: file.name }) });
      if (append) el.value += (el.value ? '\n' : '') + result.url;
      else el.value = result.url;
    } catch (err) { alert(`Failed to upload "${file.name}": ${err.message}`); }
  }
  input.value = '';
  input.disabled = false;
}

/* Auth */
const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');

function checkAuth() {
  if (!token) { showLogin(); return; }
  api('/api/auth/me').then(() => showAdmin()).catch(() => { token = null; localStorage.removeItem('admin_token'); showLogin(); });
}

function showLogin() { loginView.style.display = 'flex'; adminView.style.display = 'none'; startLogin3D(); }
function showAdmin() { loginView.style.display = 'none'; adminView.style.display = 'block'; stopLogin3D(); loadDashboard(); startExpirationChecker(); }

document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  btn.disabled = true; btn.textContent = 'Signing in...'; err.textContent = '';
  api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    .then(data => { token = data.token; localStorage.setItem('admin_token', token); showAdmin(); })
    .catch(e => err.textContent = e.message)
    .finally(() => { btn.disabled = false; btn.textContent = 'Sign In'; });
});

function logout() { token = null; localStorage.removeItem('admin_token'); showLogin(); }

/* Navigation */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const viewId = 'view' + btn.dataset.view.charAt(0).toUpperCase() + btn.dataset.view.slice(1);
    document.getElementById(viewId).classList.add('active');
    const v = btn.dataset.view;
    if (v === 'properties') loadProperties();
    if (v === 'blog') loadPosts();
    if (v === 'messages') loadMessages();

    if (v === 'dashboard') loadDashboard();
    if (v === 'payments') loadPayments();
    if (v === 'testimonials') loadTestimonials();
    if (v === 'bank') { loadBankInfo(); loadStripeSettings(); }
    if (v === 'contactinfo') loadContactInfo();
    if (v === 'settings') { checkPasskeyStatus(); checkFaceStatus(); }
  });
});

document.querySelector('.btn-header-icon')?.addEventListener('click', function() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const settingsNav = document.querySelector('.nav-btn[data-view="settings"]');
  if (settingsNav) settingsNav.classList.add('active');
  document.getElementById('viewSettings').classList.add('active');
  checkPasskeyStatus();
});

/* Dashboard */
let chartPaymentsInstance = null;
let chartPropsInstance = null;

async function loadDashboard() {
  try {
    const [props, posts, msgs, testis, payments] = await Promise.all([
      api('/api/properties'),
      api('/api/blog?published=0'),
      api('/api/contact/messages?limit=1'),
      api('/api/testimonials'),
      api('/api/payments'),
    ]);
    document.getElementById('statProperties').textContent = props.length;
    document.getElementById('statFeatured').textContent = props.filter(p => p.featured).length;
    document.getElementById('statPosts').textContent = posts.length;
    document.getElementById('statMessages').textContent = msgs.total;
    document.getElementById('statTestimonials').textContent = testis.length;

    /* Payments chart */
    const byMonth = {};
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    payments.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      byMonth[key] = (byMonth[key] || 0) + p.amount;
    });
    const labels = Object.keys(byMonth).slice(-12);
    const amounts = labels.map(l => byMonth[l]);
    if (chartPaymentsInstance) chartPaymentsInstance.destroy();
    const ctx1 = document.getElementById('chartPayments');
    if (ctx1 && labels.length) {
      chartPaymentsInstance = new Chart(ctx1, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Revenue ($)', data: amounts, backgroundColor: '#2563eb', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } } }
      });
    }

    /* Property type distribution */
    const typeCount = {};
    props.forEach(p => { typeCount[p.type] = (typeCount[p.type] || 0) + 1; });
    const typeLabels = Object.keys(typeCount);
    const typeValues = Object.values(typeCount);
    const colors = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626'];
    if (chartPropsInstance) chartPropsInstance.destroy();
    const ctx2 = document.getElementById('chartProperties');
    if (ctx2 && typeLabels.length) {
      chartPropsInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: typeLabels, datasets: [{ data: typeValues, backgroundColor: colors.slice(0, typeLabels.length) }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  } catch (e) { console.error('Admin error:', e.message); }
}

/* Properties */
let editingPropertyId = null;
let allProperties = [];

function formatPrice(p) {
  if (p.badge === 'rent') return `$${p.price.toLocaleString()}/mo`;
  return p.price >= 1000000 ? `$${(p.price / 1000000).toFixed(1)}M` : `$${p.price.toLocaleString()}`;
}

async function loadProperties() {
  try {
    allProperties = await api('/api/properties');
    renderProperties(allProperties);
  } catch (e) { console.error('Admin error:', e.message); }
}

function renderProperties(props) {
  const tbody = document.getElementById('propertiesBody');
  const empty = document.getElementById('propertiesEmpty');
  const pagEl = document.getElementById('pagination_Properties');
  tbody.innerHTML = '';
  if (props.length === 0) { empty.style.display = 'block'; pagEl.style.display = 'none'; return; }
  empty.style.display = 'none';
  const pageItems = adminPaginate('Properties', props);
  pagEl.style.display = props.length > ADMIN_PAGE_SIZE ? 'flex' : 'none';
  const durationLabels = { '1month': '1 Month', '6months': '6 Months', '1year': '1 Year' };
  const durationMonths = { '1month': 1, '6months': 6, '1year': 12 };
  Promise.all([api('/api/payments/summary').catch(() => []), api('/api/payments').catch(() => [])]).then(([summary, payments]) => {
    const smap = {};
    summary.forEach(s => { smap[s.id] = s; });
    const rentDurations = {};
    payments.forEach(p => {
      if (p.type === 'rent' && p.duration && p.property_id) {
        rentDurations[p.property_id] = p.duration;
      }
    });
    pageItems.forEach(p => {
      const tr = document.createElement('tr');
      const s = smap[p.id];
      const payStr = s ? `<span style="color:var(--primary)">$${s.total_collected.toLocaleString()}</span> / <span style="color:${s.balance > 0 ? '#d97706' : '#059669'}">$${s.balance.toLocaleString()}</span>` : '—';
      const status = p.status || 'available';
      const statusColor = status === 'deposited' ? '#d97706' : status === 'rented' ? '#dc2626' : '#059669';
      let statusLabel = status === 'available' ? 'Available' : status === 'deposited' ? 'Deposited' : 'Rented';
      let countdownHtml = '';
      if (status === 'rented' && p.rented_at && p.rental_duration) {
        const months = durationMonths[p.rental_duration];
        const durLabel = durationLabels[p.rental_duration] || p.rental_duration;
        statusLabel = `Rented (${durLabel})`;
        if (months) {
          const rentedAt = new Date(p.rented_at).getTime();
          const expiresAt = rentedAt + months * 30 * 24 * 60 * 60 * 1000;
          countdownHtml = `<div class="countdown-timer" data-expires="${expiresAt}" data-id="${p.id}"><i class="fas fa-clock"></i> <span class="countdown-text">calculating...</span></div>`;
        }
      } else if (status === 'rented') {
        const rd = rentDurations[p.id];
        if (rd) statusLabel = `Rented (${durationLabels[rd] || rd})`;
      }
      const cancelBtn = (status === 'deposited' || status === 'rented')
        ? `<button class="btn-outline btn-sm" onclick="cancelPropertyStatus(${p.id})" title="Cancel ${statusLabel} — make available again"><i class="fas fa-undo"></i> Cancel</button>`
        : '';
      const renewalBtn = status === 'rented' && p.renter_email
        ? `<button class="btn-outline btn-sm" onclick="sendRenewalEmail(${p.id})" title="Send renewal email to ${p.renter_email}" ${p.renewal_email_sent ? 'disabled style="opacity:0.5"' : ''}><i class="fas fa-envelope"></i> ${p.renewal_email_sent ? 'Email Sent' : 'Send Renewal'}</button>`
        : '';
      const renterInfo = status === 'rented' && p.renter_email
        ? `<br><small style="color:var(--text-muted);font-size:11px">Renter: ${p.renter_name || p.renter_email}</small>`
        : '';
      const statusBlock = `<span style="color:${statusColor};font-weight:600;font-size:12px">${statusLabel}</span>${countdownHtml}${renterInfo}${cancelBtn || renewalBtn ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + renewalBtn + ' ' + cancelBtn + '</div>' : ''}`;
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><strong>${p.title}</strong><br><small style="color:var(--text-muted)">${p.location}</small><div style="margin-top:4px">${statusBlock}</div></td>
        <td>${formatPrice(p)}</td>
        <td>${p.type}</td>
        <td><span style="color:${p.badge === 'sale' ? 'var(--primary)' : '#059669'}">${p.badge}</span></td>
        <td></td>
        <td>${payStr}</td>
        <td>${p.featured ? '<i class="fas fa-check" style="color:var(--primary)"></i>' : '—'}</td>
        <td><div class="actions">
          <button class="btn-outline btn-sm" onclick="editProperty(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-danger btn-sm" onclick="deleteProperty(${p.id})"><i class="fas fa-trash"></i></button>
        </div></td>`;
      tbody.appendChild(tr);
    });
    startCountdowns();
  }).catch(() => {
    pageItems.forEach(p => {
      const tr = document.createElement('tr');
      const status = p.status || 'available';
      const statusColor = status === 'deposited' ? '#d97706' : status === 'rented' ? '#dc2626' : '#059669';
      const statusLabel = status === 'available' ? 'Available' : status === 'deposited' ? 'Deposited' : 'Rented';
      const cancelBtn = (status === 'deposited' || status === 'rented')
        ? `<button class="btn-outline btn-sm" onclick="cancelPropertyStatus(${p.id})" title="Cancel ${statusLabel} — make available again"><i class="fas fa-undo"></i> Cancel</button>`
        : '';
      const renewalBtn = status === 'rented' && p.renter_email
        ? `<button class="btn-outline btn-sm" onclick="sendRenewalEmail(${p.id})" title="Send renewal email to ${p.renter_email}" ${p.renewal_email_sent ? 'disabled style="opacity:0.5"' : ''}><i class="fas fa-envelope"></i> ${p.renewal_email_sent ? 'Email Sent' : 'Send Renewal'}</button>`
        : '';
      const renterInfo = status === 'rented' && p.renter_email
        ? `<br><small style="color:var(--text-muted);font-size:11px">Renter: ${p.renter_name || p.renter_email}</small>`
        : '';
      const statusBlock = `<span style="color:${statusColor};font-weight:600;font-size:12px">${statusLabel}</span>${renterInfo}${cancelBtn || renewalBtn ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + renewalBtn + ' ' + cancelBtn + '</div>' : ''}`;
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><strong>${p.title}</strong><br><small style="color:var(--text-muted)">${p.location}</small><div style="margin-top:4px">${statusBlock}</div></td>
        <td>${formatPrice(p)}</td>
        <td>${p.type}</td>
        <td><span style="color:${p.badge === 'sale' ? 'var(--primary)' : '#059669'}">${p.badge}</span></td>
        <td></td>
        <td>—</td>
        <td>${p.featured ? '<i class="fas fa-check" style="color:var(--primary)"></i>' : '—'}</td>
        <td><div class="actions">
          <button class="btn-outline btn-sm" onclick="editProperty(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-danger btn-sm" onclick="deleteProperty(${p.id})"><i class="fas fa-trash"></i></button>
        </div></td>`;
      tbody.appendChild(tr);
    });
  });
}

document.getElementById('propSearch')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = allProperties.filter(p =>
    p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)
  );
  renderProperties(filtered);
});

function openPropertyForm(property) {
  editingPropertyId = property ? property.id : null;
  document.getElementById('propertyFormTitle').textContent = property ? 'Edit Property' : 'Add Property';
  document.getElementById('propertySubmit').textContent = property ? 'Update Property' : 'Save Property';
  document.getElementById('pfTitle').value = property ? property.title : '';
  document.getElementById('pfLocation').value = property ? property.location : '';
  document.getElementById('pfPrice').value = property ? property.price : '';
  document.getElementById('pfType').value = property ? property.type : 'house';
  document.getElementById('pfBeds').value = property ? property.beds : 0;
  document.getElementById('pfBaths').value = property ? property.baths : 0;
  document.getElementById('pfSqft').value = property ? property.sqft : 0;
  document.getElementById('pfYear').value = property ? property.year || '' : '';
  document.getElementById('pfBadge').value = property ? property.badge : 'sale';
  document.getElementById('pfFeatured').value = property ? (property.featured ? 1 : 0) : 0;
  document.getElementById('pfLat').value = property ? property.lat || '' : '';
  document.getElementById('pfLng').value = property ? property.lng || '' : '';
  document.getElementById('pfCoords').value = property && property.lat && property.lng ? property.lat + ', ' + property.lng : '';
  document.getElementById('pfImage').value = property ? property.image || '' : '';
  document.getElementById('pfGallery').value = property && property.gallery ? property.gallery.join('\n') : '';
  document.getElementById('pfDescription').value = property ? property.description || '' : '';
  document.getElementById('propertyModal').style.display = 'flex';
}

/* DMS to decimal converter */
function parseDMS(dmsStr) {
  const m = dmsStr.match(/(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NSEW])/i);
  if (!m) return null;
  let dec = parseInt(m[1]) + parseInt(m[2]) / 60 + parseFloat(m[3]) / 3600;
  if (m[4].toUpperCase() === 'S' || m[4].toUpperCase() === 'W') dec = -dec;
  return Math.round(dec * 100000) / 100000;
}

function tryParseCoords(input) {
  const dmsPair = input.match(/(\d+[°]\s*\d+[′']\s*[\d.]+[″"][NSEW])\s+(\d+[°]\s*\d+[′']\s*[\d.]+[″"][NSEW])/i);
  if (dmsPair) {
    const lat = parseDMS(dmsPair[1]);
    const lng = parseDMS(dmsPair[2]);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  const decPair = input.match(/([-]?\d+\.?\d*)\s*,\s*([-]?\d+\.?\d*)/);
  if (decPair) {
    const lat = parseFloat(decPair[1]);
    const lng = parseFloat(decPair[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

/* Reverse geocode: fill Location from Lat/Lng */
let _geocodeTimer = null;
function reverseGeocode(lat, lng) {
  clearTimeout(_geocodeTimer);
  _geocodeTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } });
      const data = await r.json();
      if (data.display_name) document.getElementById('pfLocation').value = data.display_name;
    } catch {}
  }, 600);
}

/* Auto-fill Location when Coordinates change */
document.getElementById('pfCoords').addEventListener('input', function() {
  const parsed = tryParseCoords(this.value);
  if (parsed) {
    document.getElementById('pfLat').value = parsed.lat;
    document.getElementById('pfLng').value = parsed.lng;
    reverseGeocode(parsed.lat, parsed.lng);
  }
});

/* Paste DMS coordinates into Coordinates field to auto-convert */
function handleDmsPaste(e) {
  const clipData = e.clipboardData || window.clipboardData;
  const text = clipData ? clipData.getData('text') : '';
  if (!text) return;
  const parsed = tryParseCoords(text);
  if (parsed) {
    e.preventDefault();
    document.getElementById('pfLat').value = parsed.lat;
    document.getElementById('pfLng').value = parsed.lng;
    document.getElementById('pfCoords').value = parsed.lat + ', ' + parsed.lng;
    reverseGeocode(parsed.lat, parsed.lng);
  }
}
document.getElementById('pfCoords').addEventListener('paste', handleDmsPaste);

function closePropertyForm() { document.getElementById('propertyModal').style.display = 'none'; }

document.getElementById('propertyForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    title: document.getElementById('pfTitle').value,
    location: document.getElementById('pfLocation').value,
    price: parseFloat(document.getElementById('pfPrice').value),
    type: document.getElementById('pfType').value,
    beds: parseInt(document.getElementById('pfBeds').value) || 0,
    baths: parseInt(document.getElementById('pfBaths').value) || 0,
    sqft: parseInt(document.getElementById('pfSqft').value) || 0,
    year: parseInt(document.getElementById('pfYear').value) || null,
    badge: document.getElementById('pfBadge').value,
    featured: parseInt(document.getElementById('pfFeatured').value) === 1,
    lat: parseFloat(document.getElementById('pfLat').value) || null,
    lng: parseFloat(document.getElementById('pfLng').value) || null,
    image: document.getElementById('pfImage').value || '',
    gallery: document.getElementById('pfGallery').value.split('\n').map(s => s.trim()).filter(Boolean),
    description: document.getElementById('pfDescription').value || '',
  };
  const btn = document.getElementById('propertySubmit');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    if (editingPropertyId) {
      await api(`/api/properties/${editingPropertyId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/api/properties', { method: 'POST', body: JSON.stringify(data) });
    }
    closePropertyForm();
    loadProperties();
    loadDashboard();
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = editingPropertyId ? 'Update Property' : 'Save Property'; }
});

async function editProperty(id) {
  try { const p = await api(`/api/properties/${id}`); openPropertyForm(p); } catch (e) { console.error('Admin error:', e.message); }
}

async function deleteProperty(id) {
  if (!confirm('Delete this property?')) return;
  try { await api(`/api/properties/${id}`, { method: 'DELETE' }); loadProperties(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

async function cancelPropertyStatus(id) {
  if (!confirm('Cancel the deposited/rented status? This will make the property visible on the website again.')) return;
  try {
    await api(`/api/properties/${id}/cancel-status`, { method: 'POST' });
    loadProperties();
  } catch (err) { alert(err.message); }
}

async function sendRenewalEmail(id) {
  if (!confirm('Send a renewal email to the renter?')) return;
  try {
    const result = await api(`/api/properties/${id}/send-renewal`, { method: 'POST' });
    alert(result.message || 'Renewal email sent');
    loadProperties();
  } catch (err) { alert(err.message); }
}

/* Countdown Timer */
let countdownInterval = null;

function startCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdowns();
  countdownInterval = setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
  document.querySelectorAll('.countdown-timer').forEach(el => {
    const expiresAt = parseInt(el.dataset.expires);
    const propId = el.dataset.id;
    const now = Date.now();
    const diff = expiresAt - now;
    const textEl = el.querySelector('.countdown-text');
    if (!textEl) return;
    if (diff <= 0) {
      textEl.innerHTML = '<span class="countdown-expired">Expired</span>';
      checkExpiredRentals();
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    textEl.innerHTML = `${days}d ${hours}h ${mins}m ${secs}s remaining`;
  });
}

async function checkExpiredRentals() {
  try {
    const result = await api('/api/properties/check-expired');
    if (result.expired && result.expired.length > 0) {
      loadProperties();
      loadDashboard();
    }
  } catch (e) { console.error('Admin error:', e.message); }
}

/* Check for expired rentals on load and every 60s */
function startExpirationChecker() {
  checkExpiredRentals();
  setInterval(checkExpiredRentals, 60000);
}

async function deleteAllProperties() {
  if (!confirm('Delete ALL properties? This cannot be undone.')) return;
  try { await api('/api/properties', { method: 'DELETE' }); loadProperties(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

/* Blog Posts */
let editingPostId = null;

async function loadPosts() {
  try {
    const posts = await api('/api/blog?published=0');
    const tbody = document.getElementById('postsBody');
    const empty = document.getElementById('postsEmpty');
    const pagEl = document.getElementById('pagination_Blog');
    tbody.innerHTML = '';
    if (posts.length === 0) { empty.style.display = 'block'; pagEl.style.display = 'none'; return; }
    empty.style.display = 'none';
    const pageItems = adminPaginate('Blog', posts);
    pagEl.style.display = posts.length > ADMIN_PAGE_SIZE ? 'flex' : 'none';
    pageItems.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><strong>${p.title}</strong></td>
        <td><code>${p.slug}</code></td>
        <td>${p.published ? '<i class="fas fa-check" style="color:var(--primary)"></i>' : '<span style="color:var(--text-muted)">Draft</span>'}</td>
        <td>${p.created_at?.split(' ')[0] || ''}</td>
        <td><div class="actions">
          <button class="btn-outline btn-sm" onclick="editPost(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-danger btn-sm" onclick="deletePost(${p.id})"><i class="fas fa-trash"></i></button>
        </div></td>`;
      tbody.appendChild(tr);
    });
  } catch (e) { console.error('Admin error:', e.message); }
}

let quillEditor = null;
document.addEventListener('DOMContentLoaded', () => {
  quillEditor = new Quill('#pfPostEditor', { theme: 'snow', modules: { toolbar: [['bold','italic','underline','strike'], [{list:'ordered'},{list:'bullet'}], ['link','image','blockquote','code-block'], [{header:[1,2,3,false]}], ['clean']] } });
});

function openPostForm(post) {
  editingPostId = post ? post.id : null;
  document.getElementById('postFormTitle').textContent = post ? 'Edit Post' : 'New Post';
  document.getElementById('postSubmit').textContent = post ? 'Update Post' : 'Save Post';
  document.getElementById('pfPostTitle').value = post ? post.title : '';
  document.getElementById('pfPostSlug').value = post ? post.slug : '';
  document.getElementById('pfPostExcerpt').value = post ? post.excerpt || '' : '';
  if (quillEditor) { if (post && post.content) quillEditor.root.innerHTML = post.content; else quillEditor.root.innerHTML = ''; }
  document.getElementById('pfPostContent').value = '';
  document.getElementById('pfPostImage').value = post ? post.image || '' : '';
  document.getElementById('pfPostAuthor').value = post ? post.author || 'Primenest Reality' : 'Primenest Reality';
  document.getElementById('pfPostPublished').value = post ? (post.published ? 1 : 0) : 1;
  document.getElementById('postModal').style.display = 'flex';
}

function closePostForm() { document.getElementById('postModal').style.display = 'none'; }

document.getElementById('postForm').addEventListener('submit', async e => {
  e.preventDefault();
  const l10n = buildFullL10n(null, 'pfPost', '', ['title','excerpt','content']);
  const data = {
    title: document.getElementById('pfPostTitle').value,
    slug: document.getElementById('pfPostSlug').value,
    excerpt: document.getElementById('pfPostExcerpt').value,
    content: quillEditor ? quillEditor.root.innerHTML : document.getElementById('pfPostContent').value,
    image: document.getElementById('pfPostImage').value,
    author: document.getElementById('pfPostAuthor').value,
    published: parseInt(document.getElementById('pfPostPublished').value) === 1,
    title_l10n: l10n.title || null,
    excerpt_l10n: l10n.excerpt || null,
    content_l10n: l10n.content || null,
  };
  const btn = document.getElementById('postSubmit');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    if (editingPostId) {
      await api(`/api/blog/${editingPostId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/api/blog', { method: 'POST', body: JSON.stringify(data) });
    }
    closePostForm();
    loadPosts();
    loadDashboard();
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = editingPostId ? 'Update Post' : 'Save Post'; }
});

async function editPost(id) {
  try {
    const posts = await api('/api/blog?published=0');
    const p = posts.find(x => x.id === id);
    if (p) openPostForm(p);
  } catch (e) { console.error('Admin error:', e.message); }
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  try { await api(`/api/blog/${id}`, { method: 'DELETE' }); loadPosts(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

async function deleteAllPosts() {
  if (!confirm('Delete ALL blog posts? This cannot be undone.')) return;
  try { await api('/api/blog', { method: 'DELETE' }); loadPosts(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

/* Testimonials */
let editingTestimonialId = null;

async function loadTestimonials() {
  try {
    const data = await api('/api/testimonials');
    const tbody = document.getElementById('testimonialsBody');
    const empty = document.getElementById('testimonialsEmpty');
    const pagEl = document.getElementById('pagination_Testimonials');
    tbody.innerHTML = '';
    if (data.length === 0) { empty.style.display = 'block'; pagEl.style.display = 'none'; return; }
    empty.style.display = 'none';
    const pageItems = adminPaginate('Testimonials', data);
    pagEl.style.display = data.length > ADMIN_PAGE_SIZE ? 'flex' : 'none';
    pageItems.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.id}</td>
        <td><strong>${t.name}</strong>${t.role ? `<br><small style="color:var(--text-muted)">${t.role}</small>` : ''}</td>
        <td>${'<i class="fas fa-star" style="color:#f59e0b"></i>'.repeat(Math.min(5, Math.max(1, t.rating || 5)))}</td>
        <td>${t.published !== false ? '<i class="fas fa-check" style="color:var(--primary)"></i>' : '<span style="color:var(--text-muted)">No</span>'}</td>
        <td>${t.display_order || 0}</td>
        <td><div class="actions">
          <button class="btn-outline btn-sm" onclick="editTestimonial(${t.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-danger btn-sm" onclick="deleteTestimonial(${t.id})"><i class="fas fa-trash"></i></button>
        </div></td>`;
      tbody.appendChild(tr);
    });
  } catch (e) { console.error('Admin error:', e.message); }
}

function openTestimonialForm(t) {
  editingTestimonialId = t ? t.id : null;
  document.getElementById('testimonialFormTitle').textContent = t ? 'Edit Testimonial' : 'Add Testimonial';
  document.getElementById('testimonialSubmit').textContent = t ? 'Update Testimonial' : 'Save Testimonial';
  document.getElementById('tfName').value = t ? t.name : '';
  document.getElementById('tfRole').value = t ? t.role || '' : '';
  document.getElementById('tfContent').value = t ? t.content || '' : '';
  document.getElementById('tfRating').value = t ? (t.rating || 5) : 5;
  document.getElementById('tfOrder').value = t ? (t.display_order || 0) : 0;
  document.getElementById('tfPublished').value = t ? (t.published !== false ? 1 : 0) : 1;
  document.getElementById('tfImage').value = t ? t.image || '' : '';
  document.getElementById('testimonialModal').style.display = 'flex';
}

function closeTestimonialForm() { document.getElementById('testimonialModal').style.display = 'none'; }

document.getElementById('testimonialForm').addEventListener('submit', async e => {
  e.preventDefault();
  const l10n = buildFullL10n(null, 'tf', '', ['name','role','content']);
  const data = {
    name: document.getElementById('tfName').value,
    role: document.getElementById('tfRole').value,
    content: document.getElementById('tfContent').value,
    rating: parseInt(document.getElementById('tfRating').value) || 5,
    display_order: parseInt(document.getElementById('tfOrder').value) || 0,
    published: parseInt(document.getElementById('tfPublished').value) === 1,
    image: document.getElementById('tfImage').value,
    name_l10n: l10n.name || null,
    role_l10n: l10n.role || null,
    content_l10n: l10n.content || null,
  };
  const btn = document.getElementById('testimonialSubmit');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    if (editingTestimonialId) {
      await api(`/api/testimonials/${editingTestimonialId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/api/testimonials', { method: 'POST', body: JSON.stringify(data) });
    }
    closeTestimonialForm();
    loadTestimonials();
    loadDashboard();
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = editingTestimonialId ? 'Update Testimonial' : 'Save Testimonial'; }
});

async function editTestimonial(id) {
  try {
    const data = await api('/api/testimonials');
    const t = data.find(x => x.id === id);
    if (t) openTestimonialForm(t);
  } catch (e) { console.error('Admin error:', e.message); }
}

async function deleteTestimonial(id) {
  if (!confirm('Delete this testimonial?')) return;
  try { await api(`/api/testimonials/${id}`, { method: 'DELETE' }); loadTestimonials(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

/* Messages */
async function loadMessages() {
  try {
    const data = await api('/api/contact/messages?limit=100');
    const list = document.getElementById('messagesList');
    const empty = document.getElementById('messagesEmpty');
    list.innerHTML = '';
    if (data.messages.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    data.messages.forEach(m => {
      const div = document.createElement('div'); div.className = 'msg-card';
      div.innerHTML = `
        <button class="btn-danger btn-sm" onclick="deleteMessage(${m.id})" style="float:right"><i class="fas fa-trash"></i></button>
        <h4>${m.name} <small style="color:var(--text-muted);font-weight:400">(${m.email})</small></h4>
        <div class="meta">
          <span><i class="far fa-calendar"></i> ${m.created_at}</span>
          ${m.inquiry_type ? `<span>Type: ${m.inquiry_type}</span>` : ''}
          ${m.phone ? `<span>Phone: ${m.phone}</span>` : ''}
        </div>
        ${m.property ? `<p><strong>Property:</strong> ${m.property}</p>` : ''}
        <p>${m.message}</p>`;
      list.appendChild(div);
    });
  } catch (e) { console.error('Admin error:', e.message); }
}

async function deleteMessage(id) {
  if (!confirm('Delete this message?')) return;
  try { await api(`/api/contact/messages/${id}`, { method: 'DELETE' }); loadMessages(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

async function deleteAllMessages() {
  if (!confirm('Delete ALL messages? This cannot be undone.')) return;
  try { await api('/api/contact/messages', { method: 'DELETE' }); loadMessages(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

/* CSV Export */
async function exportCSV(type) {
  try {
    let rows = [], headers = [];
    if (type === 'properties') {
      const data = await api('/api/properties');
      headers = ['ID', 'Title', 'Location', 'Price', 'Type', 'Beds', 'Baths', 'Sqft', 'Badge', 'Featured', 'Year'];
      rows = data.map(p => [p.id, p.title, p.location, p.price, p.type, p.beds, p.baths, p.sqft, p.badge, p.featured ? 'Yes' : 'No', p.year || '']);
    } else if (type === 'messages') {
      const data = await api('/api/contact/messages?limit=1000');
      headers = ['ID', 'Name', 'Email', 'Phone', 'Type', 'Property', 'Message', 'Date'];
      rows = data.messages.map(m => [m.id, m.name, m.email, m.phone, m.inquiry_type, m.property, m.message, m.created_at]);
    }

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${type}-export.csv`;
    a.click(); URL.revokeObjectURL(url);
  } catch (e) { console.error('Admin error:', e.message); }
}

async function importCSV(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.disabled = true;
  try {
    const text = await file.text();
    const res = await api('/api/properties/import', { method: 'POST', body: JSON.stringify({ csv: text }) });
    alert(res.message || `Imported ${res.count} properties`);
    loadProperties();
    loadDashboard();
  } catch (err) { alert('Import failed: ' + err.message); }
  finally { input.value = ''; input.disabled = false; }
}

/* Payments */
async function loadPayments() {
  try {
    const data = await api('/api/payments');
    const tbody = document.getElementById('paymentsBody');
    const empty = document.getElementById('paymentsEmpty');
    const pagEl = document.getElementById('pagination_Payments');
    tbody.innerHTML = '';
    if (data.length === 0) { empty.style.display = 'block'; pagEl.style.display = 'none'; return; }
    empty.style.display = 'none';
    const pageItems = adminPaginate('Payments', data);
    pagEl.style.display = data.length > ADMIN_PAGE_SIZE ? 'flex' : 'none';
    pageItems.forEach(p => {
      const tr = document.createElement('tr');
      tr.dataset.paymentId = p.id;
      const prop = p.properties ? `${p.properties.title}` : `#${p.property_id}`;
      const receiptHtml = p.receipt_url ? `<a href="${p.receipt_url}" target="_blank" title="View receipt"><i class="fas fa-receipt"></i></a>` : '—';
      const refundBtn = p.status === 'completed' && p.stripe_payment_intent
        ? `<button class="btn-outline btn-sm" onclick="refundPayment(${p.id})" title="Refund"><i class="fas fa-undo"></i></button>`
        : '';
      const durationLabels = { '1month': '1 Month', '6months': '6 Months', '1year': '1 Year' };
      const durationStr = p.duration && p.type === 'rent' ? (durationLabels[p.duration] || p.duration) : '—';
      tr.innerHTML = `
        <td><input type="checkbox" class="payment-checkbox" data-id="${p.id}" onchange="updateSelectedCount()"></td>
        <td>${p.id}</td>
        <td>${prop}</td>
        <td>${p.user_email}</td>
        <td>$${p.amount.toLocaleString()}</td>
        <td><span style="text-transform:capitalize">${p.type}</span></td>
        <td><span style="font-weight:500">${durationStr}</span></td>
        <td><span style="color:${p.status === 'completed' ? 'var(--primary)' : p.status === 'refunded' ? '#d97706' : '#dc2626'}">${p.status}</span></td>
        <td>${receiptHtml}</td>
        <td>${p.created_at?.split('T')[0] || ''}</td>
        <td><div class="actions">${refundBtn}<button class="btn-outline btn-sm" onclick="notifyPayment(${p.id})" title="Send email notification"><i class="fas fa-envelope"></i></button><button class="btn-danger btn-sm" onclick="deletePayment(${p.id})"><i class="fas fa-trash"></i></button></div></td>`;
      tbody.appendChild(tr);
    });
    document.getElementById('selectAllPayments').checked = false;
  } catch (e) { console.error('Admin error:', e.message); }
}

async function refundPayment(id) {
  if (!confirm('Refund this payment? This will issue a full refund through Stripe.')) return;
  try {
    await api('/api/payments/refund', { method: 'POST', body: JSON.stringify({ payment_id: id }) });
    alert('Payment refunded');
    loadPayments();
  } catch (err) { alert(err.message); }
}

async function notifyPayment(id) {
  try {
    const result = await api(`/api/payments/${id}/notify`, { method: 'POST' });
    alert(result.message || 'Notification sent');
  } catch (err) { alert('Failed: ' + err.message); }
}

async function deletePayment(id) {
  if (!confirm('Delete this payment record?')) return;
  try { await api('/api/payments/delete', { method: 'POST', body: JSON.stringify({ id }) }); loadPayments(); }
  catch (err) { alert(err.message); }
}

function toggleSelectAllPayments() {
  const checked = document.getElementById('selectAllPayments').checked;
  document.querySelectorAll('.payment-checkbox').forEach(cb => cb.checked = checked);
  updateSelectedCount();
}
function updateSelectedCount() {
  const count = document.querySelectorAll('.payment-checkbox:checked').length;
  document.getElementById('selectedCount').textContent = count;
  document.getElementById('deleteSelectedBtn').style.display = count ? 'inline-flex' : 'none';
}
async function deleteSelectedPayments() {
  const ids = [...document.querySelectorAll('.payment-checkbox:checked')].map(cb => parseInt(cb.dataset.id));
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} selected payment record(s)?`)) return;
  try { await api('/api/payments/delete', { method: 'POST', body: JSON.stringify({ ids }) }); loadPayments(); updateSelectedCount(); }
  catch (err) { alert(err.message); }
}
async function refundAllPayments() {
  if (!confirm('Refund ALL completed payments via Stripe? This will void them in test mode.')) return;
  try { const r = await api('/api/payments/refund-all', { method: 'POST' }); alert(r.message); loadPayments(); }
  catch (err) { alert(err.message); }
}
async function deleteAllPayments() {
  if (!confirm('Delete ALL payment records?')) return;
  try { await api('/api/payments', { method: 'DELETE' }); loadPayments(); }
  catch (err) { alert(err.message); }
}

/* Stripe Settings */
async function loadStripeSettings() {
  try {
    const d = await api('/api/stripe/config');
    document.getElementById('sfPubKey').value = d.publishable_key || '';
  } catch (e) { console.error('Admin error:', e.message); }
  try {
    const notif = await api('/api/payments/settings?key=notification_email');
    document.getElementById('sfNotifEmail').value = (notif && notif.email) ? notif.email : '';
  } catch (e) { console.error('Admin error:', e.message); }
  try {
    const smtp = await api('/api/payments/settings?key=gmail_smtp');
    document.getElementById('sfGmailEmail').value = (smtp && smtp.email) ? smtp.email : '';
    const passStatus = document.getElementById('sfGmailPassStatus');
    if (smtp && smtp.appPassword) {
      if (passStatus) { passStatus.textContent = '✓ App password saved'; passStatus.style.color = '#059669'; passStatus.style.display = 'block'; }
    } else {
      if (passStatus) { passStatus.textContent = '✗ No app password saved'; passStatus.style.color = '#dc2626'; passStatus.style.display = 'block'; }
    }
  } catch (e) { console.error('Admin error:', e.message); }
  try {
    const deepl = await api('/api/payments/settings?key=deepl_api_key');
    document.getElementById('sfDeeplKey').value = (deepl && deepl.key) ? deepl.key : '';
  } catch (e) { console.error('Admin error:', e.message); }
}

document.getElementById('deeplForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('deeplSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api('/api/payments/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'deepl_api_key', value: { key: document.getElementById('sfDeeplKey').value } })
    });
    alert('DeepL API key saved');
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save DeepL Key'; }
});

document.getElementById('stripeForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('stripeSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api('/api/stripe/save', {
      method: 'POST',
      body: JSON.stringify({
        publishable_key: document.getElementById('sfPubKey').value,
        secret_key: document.getElementById('sfSecKey').value,
        webhook_secret: document.getElementById('sfWhsec').value,
      })
    });
    const notifEmail = document.getElementById('sfNotifEmail').value.trim();
    if (notifEmail) {
      await api('/api/payments/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'notification_email', value: { email: notifEmail } })
      });
    }
    const gmailEmail = document.getElementById('sfGmailEmail').value.trim();
    const gmailPass = document.getElementById('sfGmailPass').value.trim();
    if (gmailEmail && gmailPass) {
      await api('/api/payments/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'gmail_smtp', value: { email: gmailEmail, appPassword: gmailPass } })
      });
      document.getElementById('sfGmailPass').value = '';
      const passStatus = document.getElementById('sfGmailPassStatus');
      if (passStatus) { passStatus.textContent = '✓ App password saved'; passStatus.style.color = '#059669'; passStatus.style.display = 'block'; }
    }
    alert('Settings saved');
    document.getElementById('sfSecKey').value = '';
    document.getElementById('sfWhsec').value = '';
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save Stripe Keys'; }
});

/* Contact Info */
async function loadContactInfo() {
  try {
    const d = await api('/api/settings/contact');
    document.getElementById('ciPhone').value = d.phone || '';
    document.getElementById('ciEmail').value = d.email || '';
    document.getElementById('ciAddress').value = d.address || '';
    document.getElementById('ciWhatsapp').value = d.whatsapp || '';
    document.getElementById('ciWhatsappMsg').value = d.whatsapp_message || '';
    document.getElementById('ciFacebook').value = d.facebook_url || '';
    document.getElementById('ciInstagram').value = d.instagram_url || '';
    document.getElementById('ciLinkedin').value = d.linkedin_url || '';
  } catch (e) { console.error('Admin error:', e.message); }
}

document.getElementById('contactInfoForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('ciSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api('/api/settings/contact', {
      method: 'PUT',
      body: JSON.stringify({
        phone: document.getElementById('ciPhone').value,
        email: document.getElementById('ciEmail').value,
        address: document.getElementById('ciAddress').value,
        whatsapp: document.getElementById('ciWhatsapp').value,
        whatsapp_message: document.getElementById('ciWhatsappMsg').value,
        facebook_url: document.getElementById('ciFacebook').value,
        instagram_url: document.getElementById('ciInstagram').value,
        linkedin_url: document.getElementById('ciLinkedin').value,
      })
    });
    alert('Contact info saved! Refresh your website to see changes.');
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save Contact Info'; }
});

/* Bank Info */
async function loadBankInfo() {
  try {
    const d = await api('/api/payments/settings');
    document.getElementById('bfBankName').value = d.bank_name || '';
    document.getElementById('bfAccountName').value = d.account_name || '';
    document.getElementById('bfAccountNumber').value = d.account_number || '';
    document.getElementById('bfRouting').value = d.routing || '';
    document.getElementById('bfIban').value = d.iban || '';
    document.getElementById('bfSwift').value = d.swift || '';
  } catch (e) { console.error('Admin error:', e.message); }
}

document.getElementById('bankForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('bankSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api('/api/payments/settings', {
      method: 'PUT',
      body: JSON.stringify({
        bank_name: document.getElementById('bfBankName').value,
        account_name: document.getElementById('bfAccountName').value,
        account_number: document.getElementById('bfAccountNumber').value,
        routing: document.getElementById('bfRouting').value,
        iban: document.getElementById('bfIban').value,
        swift: document.getElementById('bfSwift').value,
      })
    });
    alert('Bank info saved');
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save Bank Info'; }
});

/* Change Password */
function showChangePassword() { document.getElementById('passwordModal').style.display = 'flex'; document.getElementById('passwordError').textContent = ''; }
function closePasswordModal() { document.getElementById('passwordModal').style.display = 'none'; }
document.getElementById('passwordForm').addEventListener('submit', async e => {
  e.preventDefault();
  const current = document.getElementById('pwCurrent').value;
  const newPw = document.getElementById('pwNew').value;
  const err = document.getElementById('passwordError');
  try {
    await api('/api/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword: current, newPassword: newPw }) });
    alert('Password updated');
    closePasswordModal();
    document.getElementById('passwordForm').reset();
  } catch (e) { err.textContent = e.message; }
});

/* ═══ 3D Login Scene ═══ */
let loginScene3d = null;
let loginAnimId = null;

function startLogin3D() {
  if (loginScene3d) return;
  const canvas = document.getElementById('three-canvas');
  if (!canvas || typeof THREE === 'undefined') return;
  if (loginAnimId) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 8;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  /* Lights */
  scene.add(new THREE.AmbientLight(0xffeedd, 0.6));
  const l1 = new THREE.PointLight(0xd4943a, 2, 20); l1.position.set(5, 5, 5); scene.add(l1);
  const l2 = new THREE.PointLight(0xc06040, 1.5, 20); l2.position.set(-5, -3, 5); scene.add(l2);
  const l3 = new THREE.PointLight(0x86efac, 0.8, 20); l3.position.set(0, -5, 5); scene.add(l3);

  /* Center icosahedron */
  const ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xd4943a, metalness: 0.15, roughness: 0.2, transparent: true, opacity: 0.85, clearcoat: 0.3, clearcoatRoughness: 0.3, emissive: 0x8a6a40, emissiveIntensity: 0.1 })
  );
  scene.add(ico);
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.65, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xf0c68a, wireframe: true, transparent: true, opacity: 0.12, emissive: 0xd4943a, emissiveIntensity: 0.03 })
  );
  ico.add(wire);

  /* Rings */
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.025, 16, 80),
    new THREE.MeshPhysicalMaterial({ color: 0xf0c68a, emissive: 0xd4943a, emissiveIntensity: 0.15, transparent: true, opacity: 0.25, metalness: 0.3, roughness: 0.4 })
  );
  ring.rotation.x = Math.PI / 2.5; scene.add(ring);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.015, 16, 80),
    new THREE.MeshPhysicalMaterial({ color: 0xc06040, emissive: 0xc06040, emissiveIntensity: 0.1, transparent: true, opacity: 0.15, metalness: 0.2, roughness: 0.5 })
  );
  ring2.rotation.x = Math.PI / 1.8; ring2.rotation.z = 0.5; scene.add(ring2);

  /* Orbiting dots */
  const dotGroup = new THREE.Group();
  const dotGeo = new THREE.SphereGeometry(0.04, 8, 8);
  for (let i = 0; i < 40; i++) {
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshPhysicalMaterial({
      color: i % 3 === 0 ? 0xf0c68a : i % 3 === 1 ? 0xc06040 : 0x86efac,
      emissive: i % 3 === 0 ? 0xd4943a : i % 3 === 1 ? 0xc06040 : 0x34a853,
      emissiveIntensity: 0.15, transparent: true, opacity: 0.3
    }));
    const radius = 3.2 + Math.random() * 0.8;
    const theta = (i / 40) * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    dot.position.set(radius * Math.sin(theta) * Math.cos(phi), radius * Math.sin(theta) * Math.sin(phi), radius * Math.cos(theta));
    dot.userData = { radius, speed: 0.1 + Math.random() * 0.1, phase: Math.random() * Math.PI * 2, phi };
    dotGroup.add(dot);
  }
  scene.add(dotGroup);

  /* Particle field */
  const pCount = 2000;
  const pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const r = 5 + Math.random() * 15, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(t) * Math.cos(p);
    pos[i * 3 + 1] = r * Math.sin(t) * Math.sin(p);
    pos[i * 3 + 2] = r * Math.cos(t);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xf0c68a, size: 0.035, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* Resize */
  const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
  window.addEventListener('resize', onResize);

  /* Mouse */
  const mouse = { x: 0, y: 0 };
  const onMouse = (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; };
  document.addEventListener('mousemove', onMouse);
  document.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouse.x = (t.clientX / window.innerWidth) * 2 - 1; mouse.y = -(t.clientY / window.innerHeight) * 2 + 1; }, { passive: true });

  /* Animation */
  let running = true;
  const target = { x: 0, y: 0 };
  function animate() {
    if (!running) return;
    loginAnimId = requestAnimationFrame(animate);
    const t = performance.now() / 1000;
    target.x += (mouse.x * 0.3 - target.x) * 0.03;
    target.y += (mouse.y * 0.3 - target.y) * 0.03;
    ico.rotation.x += 0.003; ico.rotation.y += 0.006;
    ring.rotation.z += 0.002; ring2.rotation.z -= 0.003;
    dotGroup.children.forEach(dot => {
      const d = dot.userData, a = t * d.speed + d.phase, r = d.radius;
      dot.position.x = r * Math.sin(a) * Math.cos(d.phi || 0);
      dot.position.y = r * Math.sin(a) * Math.sin(d.phi || 0);
      dot.position.z = r * Math.cos(a);
    });
    particles.rotation.y += 0.0003;
    dotGroup.rotation.x += (target.y * 0.02 - dotGroup.rotation.x) * 0.01;
    dotGroup.rotation.y += (target.x * 0.02 - dotGroup.rotation.y) * 0.01;
    camera.position.x += (target.x * 0.5 - camera.position.x) * 0.01;
    camera.position.y += (target.y * 0.5 - camera.position.y) * 0.01;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  animate();

  loginScene3d = { scene, camera, renderer, running: () => running, stop: () => { running = false; }, cleanup: () => {
    running = false;
    if (loginAnimId) { cancelAnimationFrame(loginAnimId); loginAnimId = null; }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('mousemove', onMouse);
    renderer.dispose();
    loginScene3d = null;
  }};
}

function stopLogin3D() {
  if (loginScene3d) { loginScene3d.cleanup(); }
}

/* ═══ WebAuthn — Passkey (biometric) login ═══ */

function base64ToArrayBuffer(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function webauthnSupport() {
  return typeof PublicKeyCredential !== 'undefined';
}

async function loginWithPasskey() {
  const err = document.getElementById('loginError');
  if (!webauthnSupport()) { err.textContent = 'Passkey not supported on this browser'; return; }

  const username = document.getElementById('loginUser').value.trim();

  try {
    const beginRes = await fetch(`${API}/api/auth/webauthn/login/begin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(username ? { username } : {})
    });
    const beginData = await beginRes.json();
    if (!beginRes.ok) throw new Error(beginData.error);

    const challengeToken = beginData.challengeToken;
    const rawChallenge = beginData.challenge;
    delete beginData.challengeToken;

    beginData.challenge = base64ToArrayBuffer(beginData.challenge);
    if (beginData.allowCredentials) {
      beginData.allowCredentials.forEach(c => { c.id = base64ToArrayBuffer(c.id); });
    }

    const cred = await navigator.credentials.get({ publicKey: beginData });
    if (!cred) throw new Error('Passkey authentication cancelled');

    const authData = {
      id: cred.id,
      rawId: arrayBufferToBase64(cred.rawId),
      type: cred.type,
      challenge: rawChallenge,
      challengeToken,
      response: {
        authenticatorData: arrayBufferToBase64(cred.response.authenticatorData),
        clientDataJSON: arrayBufferToBase64(cred.response.clientDataJSON),
        signature: arrayBufferToBase64(cred.response.signature),
        userHandle: cred.response.userHandle ? arrayBufferToBase64(cred.response.userHandle) : null,
      },
    };

    const completeRes = await fetch(`${API}/api/auth/webauthn/login/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData)
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error);

    token = completeData.token;
    localStorage.setItem('admin_token', token);
    showAdmin();
  } catch (e) {
    if (e.name === 'NotAllowedError') return;
    err.textContent = e.message;
  }
}

async function setupPasskey() {
  if (!webauthnSupport()) { alert('Passkey not supported on this browser'); return; }

  try {
    const beginRes = await fetch(`${API}/api/auth/webauthn/register/begin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    const beginData = await beginRes.json();
    if (!beginRes.ok) throw new Error(beginData.error);

    const challengeToken = beginData.challengeToken;
    const rawChallenge = beginData.challenge;
    delete beginData.challengeToken;

    beginData.challenge = base64ToArrayBuffer(beginData.challenge);
    beginData.user.id = base64ToArrayBuffer(beginData.user.id);
    if (beginData.excludeCredentials) {
      beginData.excludeCredentials.forEach(c => { c.id = base64ToArrayBuffer(c.id); });
    }

    const cred = await navigator.credentials.create({ publicKey: beginData });
    if (!cred) throw new Error('Passkey registration cancelled');

    const regData = {
      id: cred.id,
      rawId: arrayBufferToBase64(cred.rawId),
      type: cred.type,
      challenge: rawChallenge,
      challengeToken,
      response: {
        clientDataJSON: arrayBufferToBase64(cred.response.clientDataJSON),
        attestationObject: arrayBufferToBase64(cred.response.attestationObject),
        transports: cred.response.getTransports ? cred.response.getTransports() : [],
      },
    };

    const completeRes = await fetch(`${API}/api/auth/webauthn/register/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(regData)
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error);

    document.getElementById('settingsPasskeyStatus').textContent = 'Passkey set up successfully!';
    document.getElementById('settingsSetupPasskeyBtn').style.display = 'none';
    document.getElementById('settingsRemovePasskeyBtn').style.display = 'inline-flex';
  } catch (e) {
    if (e.name === 'NotAllowedError') return;
    alert(e.message);
  }
}

async function removePasskey() {
  if (!confirm('Remove your saved passkey?')) return;
  alert('Delete the passkey from your device settings (browser password manager). The passkey record has been removed from the server.');
  try {
    await fetch(`${API}/api/auth/webauthn/passkeys`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    document.getElementById('settingsPasskeyStatus').textContent = 'Passkey removed.';
    document.getElementById('settingsSetupPasskeyBtn').style.display = 'inline-flex';
    document.getElementById('settingsRemovePasskeyBtn').style.display = 'none';
  } catch (e) { console.error('Admin error:', e.message); }
}

async function checkPasskeyStatus() {
  try {
    const res = await fetch(`${API}/api/auth/webauthn/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.passkeys > 0) {
      document.getElementById('settingsPasskeyStatus').textContent = `Passkey ready (${data.passkeys} registered)`;
      document.getElementById('settingsSetupPasskeyBtn').style.display = 'none';
      document.getElementById('settingsRemovePasskeyBtn').style.display = 'inline-flex';
    } else {
      document.getElementById('settingsPasskeyStatus').textContent = 'No passkey set up yet';
    }
  } catch (e) { console.error('Admin error:', e.message); }
}

/* ─── Face Login (InsightFace) ─── */

function getFaceVideo() { return document.getElementById('faceVideo'); }

async function startFaceCamera() {
  const video = getFaceVideo();
  video.style.display = 'block';
  video.style.position = 'fixed';
  video.style.bottom = '20px';
  video.style.right = '20px';
  video.style.width = '240px';
  video.style.height = '180px';
  video.style.borderRadius = '12px';
  video.style.border = '2px solid var(--primary)';
  video.style.zIndex = '9999';
  video.style.objectFit = 'cover';
  video.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
  video.srcObject = stream;
  await video.play();
  return stream;
}

function stopFaceCamera(stream) {
  const video = getFaceVideo();
  video.style.display = 'none';
  video.srcObject = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
}

function timeoutPromise(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function captureFrameAsBase64(input, maxSize) {
  maxSize = maxSize || 320;
  const canvas = document.createElement('canvas');
  let w, h;
  if (input instanceof HTMLVideoElement) {
    w = input.videoWidth || 640;
    h = input.videoHeight || 480;
  } else {
    w = input.naturalWidth || input.width;
    h = input.naturalHeight || input.height;
  }
  if (w > maxSize || h > maxSize) {
    const scale = maxSize / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(input, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function enrollFaceFromPhoto(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  if (files.length < 3) {
    alert('Please select at least 3 photos of your face.');
    input.value = '';
    return;
  }

  const btn = document.getElementById('settingsSetupFaceBtn');
  btn.disabled = true; btn.textContent = 'Processing photos...';
  const status = document.getElementById('settingsFaceStatus');

  try {
    const images = [];
    for (const file of files) {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to load image'));
        el.src = URL.createObjectURL(file);
      });
      const b64 = captureFrameAsBase64(img);
      URL.revokeObjectURL(img.src);
      images.push(b64);
    }

    btn.textContent = 'Verifying face...';
    const res = await api('/api/auth/face/descriptor', {
      method: 'POST',
      body: JSON.stringify({ images }),
    });

    if (res.success) {
      status.textContent = `Face login set up with ${res.enrolled} photos!`;
      document.getElementById('settingsSetupFaceBtn').style.display = 'none';
      document.getElementById('settingsWebcamFaceBtn').style.display = 'none';
      document.getElementById('settingsRemoveFaceBtn').style.display = 'inline-flex';
    }
  } catch (e) {
    status.textContent = '';
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Upload 3+ photos';
    input.value = '';
  }
}

async function enrollFaceMulti() {
  const btn = document.getElementById('settingsWebcamFaceBtn');
  btn.disabled = true;
  const status = document.getElementById('settingsFaceStatus');
  const overlay = document.getElementById('faceOverlay');
  const counter = document.getElementById('faceCounter');
  const hint = document.getElementById('faceHint');

  let stream;
  const images = [];
  const TOTAL_PHOTOS = 5;
  const POSES = ['Look straight', 'Turn slightly left', 'Turn slightly right', 'Look slightly up', 'Look slightly down'];

  try {
    btn.textContent = 'Opening camera...';
    stream = await timeoutPromise(startFaceCamera(), 15000);
    await new Promise(r => setTimeout(r, 800));

    overlay.style.display = 'flex';
    const video = document.getElementById('faceVideo');

    for (let i = 0; i < TOTAL_PHOTOS; i++) {
      counter.textContent = `${i + 1} / ${TOTAL_PHOTOS}`;
      hint.textContent = POSES[i] || 'Hold still';
      await new Promise(r => setTimeout(r, 1200));
      images.push(captureFrameAsBase64(video));
      hint.textContent = 'Captured!';
      await new Promise(r => setTimeout(r, 400));
    }

    overlay.style.display = 'none';
    stopFaceCamera(stream); stream = null;

    btn.textContent = 'Uploading...';
    const res = await api('/api/auth/face/descriptor', {
      method: 'POST',
      body: JSON.stringify({ images }),
    });

    if (res.success) {
      status.textContent = `Face login set up with ${res.enrolled} photos!`;
      document.getElementById('settingsSetupFaceBtn').style.display = 'none';
      document.getElementById('settingsWebcamFaceBtn').style.display = 'none';
      document.getElementById('settingsRemoveFaceBtn').style.display = 'inline-flex';
    }
  } catch (e) {
    overlay.style.display = 'none';
    alert(e.message === 'Timed out' ? 'Camera timed out. Make sure your face is visible.' : e.message);
  } finally {
    if (stream) stopFaceCamera(stream);
    overlay.style.display = 'none';
    btn.disabled = false; btn.textContent = 'Enroll with webcam (5 photos)';
  }
}

async function removeFace() {
  if (!confirm('Remove your face login?')) return;
  try {
    await api('/api/auth/face/descriptor', { method: 'DELETE' });
    document.getElementById('settingsFaceStatus').textContent = 'Face login removed.';
    document.getElementById('settingsSetupFaceBtn').style.display = 'inline-flex';
    document.getElementById('settingsWebcamFaceBtn').style.display = 'inline-flex';
    document.getElementById('settingsRemoveFaceBtn').style.display = 'none';
  } catch (e) { console.error('Admin error:', e.message); }
}

async function loginWithFace() {
  const err = document.getElementById('loginError');
  const btn = document.getElementById('faceLoginBtn');
  btn.disabled = true; btn.textContent = 'Opening camera...'; err.textContent = '';

  let stream;
  try {
    stream = await timeoutPromise(startFaceCamera(), 15000);
    await new Promise(r => setTimeout(r, 1000));
    btn.textContent = 'Scanning...';

    const b64 = captureFrameAsBase64(document.getElementById('faceVideo'));
    stopFaceCamera(stream); stream = null;

    btn.textContent = 'Verifying...';
    const res = await fetch(`${API}/api/auth/face/compare`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64 }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Server error — try again'); }
    if (!res.ok) throw new Error(data.error);

    token = data.token;
    localStorage.setItem('admin_token', token);
    showAdmin();
  } catch (e) {
    if (e.name === 'NotAllowedError') return;
    err.textContent = e.message;
  } finally {
    if (stream) stopFaceCamera(stream);
    btn.disabled = false; btn.textContent = 'Sign in with face';
  }
}

async function checkFaceStatus() {
  try {
    const res = await fetch(`${API}/api/auth/face/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.enrolled) {
      document.getElementById('settingsFaceStatus').textContent = 'Face login ready';
      document.getElementById('settingsSetupFaceBtn').style.display = 'none';
      document.getElementById('settingsWebcamFaceBtn').style.display = 'none';
      document.getElementById('settingsRemoveFaceBtn').style.display = 'inline-flex';
    } else {
      document.getElementById('settingsFaceStatus').textContent = 'No face set up yet';
    }
  } catch (e) { console.error('Admin error:', e.message); }
}

// Settings form (combined username + password)
document.getElementById('settingsForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const current = document.getElementById('settingsCurrentPw').value;
  const newUsername = document.getElementById('settingsNewUsername').value.trim();
  const newPassword = document.getElementById('settingsNewPassword').value;
  const err = document.getElementById('settingsError');
  const btn = this.querySelector('button[type="submit"]');
  if (!newUsername && !newPassword) { err.style.color = '#dc2626'; err.textContent = 'Enter a new username or password'; return; }
  btn.disabled = true; btn.textContent = 'Saving...'; err.textContent = '';
  try {
    const body = { currentPassword: current };
    if (newUsername) body.newUsername = newUsername;
    if (newPassword) body.newPassword = newPassword;
    await api('/api/auth/password', { method: 'PUT', body: JSON.stringify(body) });
    err.style.color = '#22c55e'; err.textContent = 'Updated successfully';
    document.getElementById('settingsCurrentPw').value = '';
    document.getElementById('settingsNewUsername').value = '';
    document.getElementById('settingsNewPassword').value = '';
  } catch (e) {
    err.style.color = '#dc2626'; err.textContent = e.message;
  }
  btn.disabled = false; btn.textContent = 'Save Changes';
});

checkAuth();