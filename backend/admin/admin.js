const API = window.location.origin;
let token = localStorage.getItem('admin_token');

function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...options, headers }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

/* Auth */
const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');

function checkAuth() {
  if (!token) { showLogin(); return; }
  api('/api/health').then(() => showAdmin()).catch(() => { token = null; localStorage.removeItem('admin_token'); showLogin(); });
}

function showLogin() { loginView.style.display = 'flex'; adminView.style.display = 'none'; }
function showAdmin() { loginView.style.display = 'none'; adminView.style.display = 'block'; loadDashboard(); }

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
    document.getElementById('view' + btn.dataset.view.charAt(0).toUpperCase() + btn.dataset.view.slice(1)).classList.add('active');
    if (btn.dataset.view === 'properties') loadProperties();
    if (btn.dataset.view === 'messages') loadMessages();
    if (btn.dataset.view === 'schedules') loadSchedules();
    if (btn.dataset.view === 'dashboard') loadDashboard();
  });
});

/* Dashboard */
async function loadDashboard() {
  try {
    const [props, msgs, scheds] = await Promise.all([
      api('/api/properties'),
      api('/api/contact/messages?limit=1'),
      api('/api/contact/schedules?limit=1'),
    ]);
    document.getElementById('statProperties').textContent = props.length;
    document.getElementById('statFeatured').textContent = props.filter(p => p.featured).length;
    document.getElementById('statMessages').textContent = msgs.total;
    document.getElementById('statSchedules').textContent = scheds.total;
  } catch {}
}

/* Properties */
let editingPropertyId = null;

function formatPrice(p) {
  if (p.badge === 'rent') return `$${p.price.toLocaleString()}/mo`;
  return p.price >= 1000000 ? `$${(p.price / 1000000).toFixed(1)}M` : `$${p.price.toLocaleString()}`;
}

async function loadProperties() {
  try {
    const props = await api('/api/properties');
    const tbody = document.getElementById('propertiesBody');
    const empty = document.getElementById('propertiesEmpty');
    tbody.innerHTML = '';
    if (props.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    props.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><strong>${p.title}</strong><br><small style="color:var(--text-muted)">${p.location}</small></td>
        <td>${formatPrice(p)}</td>
        <td>${p.type}</td>
        <td><span style="color:${p.badge === 'sale' ? 'var(--primary)' : '#059669'}">${p.badge}</span></td>
        <td>${p.featured ? '<i class="fas fa-check" style="color:var(--primary)"></i>' : '—'}</td>
        <td>
          <div class="actions">
            <button class="btn-outline btn-sm" onclick="editProperty(${p.id})"><i class="fas fa-edit"></i></button>
            <button class="btn-danger btn-sm" onclick="deleteProperty(${p.id})"><i class="fas fa-trash"></i></button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch {}
}

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
  document.getElementById('pfImage').value = property ? property.image || '' : '';
  document.getElementById('pfDescription').value = property ? property.description || '' : '';
  document.getElementById('propertyModal').style.display = 'flex';
}

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
  try {
    const p = await api(`/api/properties/${id}`);
    openPropertyForm(p);
  } catch {}
}

async function deleteProperty(id) {
  if (!confirm('Delete this property?')) return;
  try {
    await api(`/api/properties/${id}`, { method: 'DELETE' });
    loadProperties();
    loadDashboard();
  } catch (err) { alert(err.message); }
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
      const div = document.createElement('div');
      div.className = 'msg-card';
      div.innerHTML = `
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
  } catch {}
}

/* Schedules */
async function loadSchedules() {
  try {
    const data = await api('/api/contact/schedules?limit=100');
    const list = document.getElementById('schedulesList');
    const empty = document.getElementById('schedulesEmpty');
    list.innerHTML = '';
    if (data.schedules.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    data.schedules.forEach(s => {
      const div = document.createElement('div');
      div.className = 'sched-card';
      div.innerHTML = `
        <h4>${s.name} <small style="color:var(--text-muted);font-weight:400">(${s.email})</small></h4>
        <div class="meta">
          <span><i class="far fa-calendar"></i> ${s.date} at ${s.time}</span>
          <span>Phone: ${s.phone}</span>
        </div>
        ${s.property ? `<p><strong>Property:</strong> ${s.property}</p>` : ''}
        ${s.notes ? `<p><strong>Notes:</strong> ${s.notes}</p>` : ''}`;
      list.appendChild(div);
    });
  } catch {}
}

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
    alert('Password updated successfully');
    closePasswordModal();
    document.getElementById('passwordForm').reset();
  } catch (e) { err.textContent = e.message; }
});

/* Init */
checkAuth();
