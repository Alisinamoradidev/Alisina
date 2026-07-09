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

function showLogin() { loginView.style.display = 'flex'; adminView.style.display = 'none'; startLogin3D(); }
function showAdmin() { loginView.style.display = 'none'; adminView.style.display = 'block'; stopLogin3D(); loadDashboard(); }

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
    const v = btn.dataset.view;
    if (v === 'properties') loadProperties();
    if (v === 'blog') loadPosts();
    if (v === 'messages') loadMessages();
    if (v === 'schedules') loadSchedules();
    if (v === 'dashboard') loadDashboard();
  });
});

/* Dashboard */
async function loadDashboard() {
  try {
    const [props, posts, msgs, scheds] = await Promise.all([
      api('/api/properties'),
      api('/api/blog?published=0'),
      api('/api/contact/messages?limit=1'),
      api('/api/contact/schedules?limit=1'),
    ]);
    document.getElementById('statProperties').textContent = props.length;
    document.getElementById('statFeatured').textContent = props.filter(p => p.featured).length;
    document.getElementById('statPosts').textContent = posts.length;
    document.getElementById('statMessages').textContent = msgs.total;
    document.getElementById('statSchedules').textContent = scheds.total;
    document.getElementById('statUsers').textContent = '—';
  } catch {}
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
  } catch {}
}

function renderProperties(props) {
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
      <td><div class="actions">
        <button class="btn-outline btn-sm" onclick="editProperty(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="btn-danger btn-sm" onclick="deleteProperty(${p.id})"><i class="fas fa-trash"></i></button>
      </div></td>`;
    tbody.appendChild(tr);
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
  document.getElementById('pfImage').value = property ? property.image || '' : '';
  document.getElementById('pfGallery').value = property && property.gallery ? property.gallery.join('\n') : '';
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
  try { const p = await api(`/api/properties/${id}`); openPropertyForm(p); } catch {}
}

async function deleteProperty(id) {
  if (!confirm('Delete this property?')) return;
  try { await api(`/api/properties/${id}`, { method: 'DELETE' }); loadProperties(); loadDashboard(); }
  catch (err) { alert(err.message); }
}

/* Blog Posts */
let editingPostId = null;

async function loadPosts() {
  try {
    const posts = await api('/api/blog?published=0');
    const tbody = document.getElementById('postsBody');
    const empty = document.getElementById('postsEmpty');
    tbody.innerHTML = '';
    if (posts.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    posts.forEach(p => {
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
  } catch {}
}

function openPostForm(post) {
  editingPostId = post ? post.id : null;
  document.getElementById('postFormTitle').textContent = post ? 'Edit Post' : 'New Post';
  document.getElementById('postSubmit').textContent = post ? 'Update Post' : 'Save Post';
  document.getElementById('pfPostTitle').value = post ? post.title : '';
  document.getElementById('pfPostSlug').value = post ? post.slug : '';
  document.getElementById('pfPostExcerpt').value = post ? post.excerpt || '' : '';
  document.getElementById('pfPostContent').value = post ? post.content || '' : '';
  document.getElementById('pfPostImage').value = post ? post.image || '' : '';
  document.getElementById('pfPostAuthor').value = post ? post.author || 'Alisina Moradi' : 'Alisina Moradi';
  document.getElementById('pfPostPublished').value = post ? (post.published ? 1 : 0) : 1;
  document.getElementById('postModal').style.display = 'flex';
}

function closePostForm() { document.getElementById('postModal').style.display = 'none'; }

document.getElementById('postForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    title: document.getElementById('pfPostTitle').value,
    slug: document.getElementById('pfPostSlug').value,
    excerpt: document.getElementById('pfPostExcerpt').value,
    content: document.getElementById('pfPostContent').value,
    image: document.getElementById('pfPostImage').value,
    author: document.getElementById('pfPostAuthor').value,
    published: parseInt(document.getElementById('pfPostPublished').value) === 1,
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
  } catch {}
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  try { await api(`/api/blog/${id}`, { method: 'DELETE' }); loadPosts(); loadDashboard(); }
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
      const div = document.createElement('div'); div.className = 'sched-card';
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
    } else if (type === 'schedules') {
      const data = await api('/api/contact/schedules?limit=1000');
      headers = ['ID', 'Name', 'Email', 'Phone', 'Property', 'Date', 'Time', 'Notes'];
      rows = data.schedules.map(s => [s.id, s.name, s.email, s.phone, s.property, s.date, s.time, s.notes]);
    }

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${type}-export.csv`;
    a.click(); URL.revokeObjectURL(url);
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

  scene.add(new THREE.AmbientLight(0x222244, 0.5));
  const l1 = new THREE.PointLight(0x6366f1, 2, 20); l1.position.set(5, 5, 5); scene.add(l1);
  const l2 = new THREE.PointLight(0xec4899, 1.5, 20); l2.position.set(-5, -3, 5); scene.add(l2);
  const l3 = new THREE.PointLight(0x22d3ee, 0.8, 20); l3.position.set(0, -5, 5); scene.add(l3);

  const ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 1),
    new THREE.MeshPhysicalMaterial({ color: 0x6366f1, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.3, emissive: 0x312e81, emissiveIntensity: 0.15 })
  );
  scene.add(ico);
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.65, 1),
    new THREE.MeshPhysicalMaterial({ color: 0x818cf8, wireframe: true, transparent: true, opacity: 0.15, emissive: 0x6366f1, emissiveIntensity: 0.05 })
  );
  ico.add(wire);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.025, 16, 80),
    new THREE.MeshPhysicalMaterial({ color: 0x818cf8, emissive: 0x6366f1, emissiveIntensity: 0.3, transparent: true, opacity: 0.3, metalness: 0.8, roughness: 0.2 })
  );
  ring.rotation.x = Math.PI / 2.5; scene.add(ring);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.015, 16, 80),
    new THREE.MeshPhysicalMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.2, transparent: true, opacity: 0.2, metalness: 0.6, roughness: 0.3 })
  );
  ring2.rotation.x = Math.PI / 1.8; ring2.rotation.z = 0.5; scene.add(ring2);

  const dotGroup = new THREE.Group();
  const dotGeo = new THREE.SphereGeometry(0.04, 8, 8);
  for (let i = 0; i < 40; i++) {
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshPhysicalMaterial({
      color: i % 3 === 0 ? 0x818cf8 : i % 3 === 1 ? 0xa855f7 : 0x22d3ee,
      emissive: i % 3 === 0 ? 0x6366f1 : i % 3 === 1 ? 0xa855f7 : 0x22d3ee,
      emissiveIntensity: 0.5, transparent: true, opacity: 0.6
    }));
    const radius = 3.2 + Math.random() * 0.8;
    const theta = (i / 40) * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    dot.position.set(radius * Math.sin(theta) * Math.cos(phi), radius * Math.sin(theta) * Math.sin(phi), radius * Math.cos(theta));
    dot.userData = { radius, speed: 0.1 + Math.random() * 0.1, phase: Math.random() * Math.PI * 2, phi };
    dotGroup.add(dot);
  }
  scene.add(dotGroup);

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
  const pMat = new THREE.PointsMaterial({ color: 0x818cf8, size: 0.04, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
  window.addEventListener('resize', onResize);

  const mouse = { x: 0, y: 0 };
  const onMouse = (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; };
  document.addEventListener('mousemove', onMouse);
  document.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouse.x = (t.clientX / window.innerWidth) * 2 - 1; mouse.y = -(t.clientY / window.innerHeight) * 2 + 1; }, { passive: true });

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

  loginScene3d = { scene, camera, renderer, cleanup: () => {
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

checkAuth();
