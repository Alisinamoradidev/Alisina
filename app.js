let properties = [
  { id: 1, title: "Modern Downtown Apartment", location: "123 Main St, New York, NY", price: 450000, type: "apartment", beds: 2, baths: 2, sqft: 1200, image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80", badge: "sale", featured: true, year: 2021, lat: 40.7128, lng: -74.006 },
  { id: 2, title: "Luxury Villa with Pool", location: "456 Ocean Dr, Miami, FL", price: 1200000, type: "villa", beds: 5, baths: 4, sqft: 4200, image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&q=80", badge: "sale", featured: true, year: 2023, lat: 25.7617, lng: -80.1918 },
  { id: 3, title: "Cozy Suburban House", location: "789 Oak Ln, Austin, TX", price: 320000, type: "house", beds: 3, baths: 2, sqft: 1800, image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80", badge: "sale", featured: true, year: 2019, lat: 30.2672, lng: -97.7431 },
  { id: 4, title: "Downtown Studio Apartment", location: "321 Pine St, Seattle, WA", price: 1800, type: "apartment", beds: 1, baths: 1, sqft: 600, image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80", badge: "rent", featured: false, year: 2020, lat: 47.6062, lng: -122.3321 },
  { id: 5, title: "Beachfront Condo", location: "555 Shore Dr, Los Angeles, CA", price: 680000, type: "condo", beds: 3, baths: 2, sqft: 1500, image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80", badge: "sale", featured: true, year: 2022, lat: 34.0522, lng: -118.2437 },
  { id: 6, title: "Mountain View House", location: "777 Summit Rd, Denver, CO", price: 2500, type: "house", beds: 4, baths: 3, sqft: 2400, image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80", badge: "rent", featured: false, year: 2018, lat: 39.7392, lng: -104.9903 },
  { id: 7, title: "Penthouse Suite", location: "999 Skyline Blvd, Chicago, IL", price: 2100000, type: "condo", beds: 4, baths: 3, sqft: 3200, image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80", badge: "sale", featured: true, year: 2024, lat: 41.8781, lng: -87.6298 },
  { id: 8, title: "Garden Apartment", location: "222 Green St, Portland, OR", price: 1400, type: "apartment", beds: 2, baths: 1, sqft: 850, image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80", badge: "rent", featured: false, year: 2017, lat: 45.5152, lng: -122.6784 },
  { id: 9, title: "Colonial Family Home", location: "444 Maple Ave, Boston, MA", price: 575000, type: "house", beds: 4, baths: 3, sqft: 2600, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80", badge: "sale", featured: true, year: 2016, lat: 42.3601, lng: -71.0589 }
];

async function loadPropertiesFromApi() {
  try {
    const res = await fetch(`${API_URL}/api/properties`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.length > 0) {
      properties = data;
      updateListings();
    }
  } catch {}
}

const $ = id => document.getElementById(id);
const listingsGrid = $('listingsGrid');
const noResults = $('noResults');
const resultsCount = $('resultsCount');
const searchInput = $('searchInput');
const priceFilter = $('priceFilter');
const typeFilter = $('typeFilter');
const sortSelect = $('sortSelect');
const nav = $('nav');
const contactForm = $('contactForm');
const modalOverlay = $('modalOverlay');
const scrollTop = $('scrollTop');
let favorites = new Set(JSON.parse(localStorage.getItem('favs') || '[]'));

function formatPrice(price, badge) {
  if (badge === 'rent') return `$${price.toLocaleString()}/mo`;
  return price >= 1000000 ? `$${(price / 1000000).toFixed(1)}M` : `$${price.toLocaleString()}`;
}

function getDescription(type) {
  const desc = {
    house: "This stunning home features an open floor plan with abundant natural light, modern finishes throughout, and a spacious backyard perfect for entertaining.",
    apartment: "This stylish apartment offers contemporary living in the heart of the city. Features include hardwood floors, in-unit laundry, and a private balcony with skyline views.",
    condo: "This beautifully maintained condo offers resort-style living with top-of-the-line amenities. Enjoy the community pool, gym, and 24-hour concierge service.",
    villa: "Experience luxury living in this exquisite villa featuring Mediterranean architecture, private pool, landscaped gardens, and premium finishes throughout."
  };
  return desc[type] || "This beautiful property offers modern finishes and an open floor plan.";
}

function setFavIcon(btn, id) {
  const icon = btn.querySelector('i');
  icon.className = favorites.has(id) ? 'fas fa-heart' : 'far fa-heart';
}

function createPropertyCard(p) {
  const card = document.createElement('div');
  card.className = 'property-card';
  card.dataset.id = p.id;
  card.innerHTML = `
    <div class="property-image">
      <img src="${p.image}" alt="${p.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22><rect fill=%22%23d1d5db%22 width=%22600%22 height=%22400%22/><text fill=%22%236b7280%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>No Image</text></svg>'">
      <span class="property-badge ${p.badge === 'sale' ? 'badge-sale' : 'badge-rent'}">${p.badge === 'sale' ? 'For Sale' : 'For Rent'}</span>
      <button class="property-fav" data-id="${p.id}"><i class="far fa-heart"></i></button>
    </div>
    <div class="property-body">
      <div class="property-price">${formatPrice(p.price, p.badge)}</div>
      <div class="property-title">${p.title}</div>
      <div class="property-location"><i class="fas fa-map-marker-alt"></i> ${p.location}</div>
      <div class="property-details">
        <span><i class="fas fa-bed"></i> ${p.beds} Beds</span>
        <span><i class="fas fa-bath"></i> ${p.baths} Baths</span>
        <span><i class="fas fa-ruler-combined"></i> ${p.sqft.toLocaleString()} sqft</span>
      </div>
    </div>`;
  setFavIcon(card.querySelector('.property-fav'), p.id);
  return card;
}

function matchesPrice(price, filter) {
  if (!filter) return true;
  const [min, max] = filter.split('-').map(Number);
  return price >= min && price <= max;
}

function sortProperties(list, sortBy) {
  const sorted = [...list];
  if (sortBy === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sortBy === 'name-asc') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === 'name-desc') sorted.sort((a, b) => b.title.localeCompare(a.title));
  return sorted;
}

function renderProperties(list) {
  listingsGrid.innerHTML = '';
  if (list.length === 0) { noResults.classList.add('visible'); resultsCount.textContent = 'No properties found'; return; }
  noResults.classList.remove('visible');
  resultsCount.textContent = `Showing ${list.length} of ${properties.length} properties`;
  list.forEach(p => listingsGrid.appendChild(createPropertyCard(p)));
  requestAnimationFrame(() => {
    document.querySelectorAll('.property-card').forEach((card, i) => setTimeout(() => card.classList.add('visible'), i * 80));
  });
}

function getFilteredAndSorted() {
  const q = searchInput.value.toLowerCase().trim();
  const pv = priceFilter.value;
  const tv = typeFilter.value;
  const sv = sortSelect.value;
  let filtered = properties.filter(p => {
    const ms = !q || p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
    return ms && matchesPrice(p.price, pv) && (!tv || p.type === tv);
  });
  return sortProperties(filtered, sv);
}

function updateListings() { renderProperties(getFilteredAndSorted()); }

$('searchForm').addEventListener('submit', e => { e.preventDefault(); updateListings(); });
[searchInput, priceFilter, typeFilter, sortSelect].forEach(el => { el.addEventListener('input', updateListings); el.addEventListener('change', updateListings); });

listingsGrid.addEventListener('click', e => {
  const favBtn = e.target.closest('.property-fav');
  if (favBtn) {
    e.stopPropagation();
    const id = Number(favBtn.dataset.id);
    const wasFav = favorites.has(id);
    wasFav ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    setFavIcon(favBtn, id);
    showToast(wasFav ? 'Removed from favorites' : 'Added to favorites');
    if (userToken) {
      fetch(`${API_URL}/api/users/favorites/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' } }).catch(() => {});
    }
    return;
  }
  const card = e.target.closest('.property-card');
  if (card) { const p = properties.find(x => x.id === Number(card.dataset.id)); if (p) openModal(p); }
});

function openModal(p) {
  $('modalImage').innerHTML = `<img src="${p.image.replace('w=600', 'w=800')}" alt="${p.title}">`;
  $('modalTitle').textContent = p.title;
  $('modalPrice').textContent = formatPrice(p.price, p.badge);
  $('modalLocation').querySelector('span').textContent = p.location;
  $('modalDetails').innerHTML = `<span><i class="fas fa-bed"></i> ${p.beds} Beds</span><span><i class="fas fa-bath"></i> ${p.baths} Baths</span><span><i class="fas fa-ruler-combined"></i> ${p.sqft.toLocaleString()} sqft</span><span><i class="fas fa-calendar"></i> Built ${p.year}</span>`;
  $('modalDescription').textContent = getDescription(p.type);
  const mf = $('modalFav'), icon = mf.querySelector('i');
  if (favorites.has(p.id)) { icon.className = 'fas fa-heart'; mf.classList.add('saved'); } else { icon.className = 'far fa-heart'; mf.classList.remove('saved'); }
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  mf.onclick = () => {
    favorites.has(p.id) ? favorites.delete(p.id) : favorites.add(p.id);
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    const ic = mf.querySelector('i');
    if (favorites.has(p.id)) { ic.className = 'fas fa-heart'; mf.classList.add('saved'); } else { ic.className = 'far fa-heart'; mf.classList.remove('saved'); }
    const cf = document.querySelector(`.property-fav[data-id="${p.id}"]`);
    if (cf) setFavIcon(cf, p.id);
    showToast(favorites.has(p.id) ? 'Added to favorites' : 'Removed from favorites');
  };
  $('modalSchedule').onclick = () => { closeModal(); $('scheduleProperty').value = `${p.title} - ${p.location}`; $('scheduleSection').scrollIntoView({ behavior: 'smooth' }); };
}

function closeModal() { modalOverlay.classList.remove('active'); document.body.style.overflow = ''; }
$('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('modalInquire').addEventListener('click', () => {
  const t = $('modalTitle').textContent, l = $('modalLocation').querySelector('span').textContent, pr = $('modalPrice').textContent;
  closeModal();
  $('inquiryProperty').value = `${t} - ${l} (${pr})`;
  $('inquiryType').value = pr.includes('/mo') ? 'rent' : 'buy';
  document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => contactForm.querySelector('input[name="name"]').focus(), 600);
});

$('mobileToggle').addEventListener('click', () => nav.classList.toggle('active'));
nav.querySelectorAll('a').forEach(l => l.addEventListener('click', () => nav.classList.remove('active')));
document.addEventListener('click', e => { if (!e.target.closest('.header-inner')) nav.classList.remove('active'); });

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = contactForm.querySelector('.btn-submit');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  const fd = new FormData(contactForm);
  if (fd.get('_honey')) return;
  const payload = { name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), inquiry_type: fd.get('inquiry_type'), property: fd.get('property'), message: fd.get('message') };
  try {
    const res = await fetch(`${API_URL}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to save');
    contactForm.submit();
  } catch {
    btn.textContent = 'Send Message';
    btn.disabled = false;
    showToast('Could not send. Try again.');
  }
});
if (window.location.search.includes('sent=true')) { showToast('Message sent! I\'ll get back to you soon.'); window.history.replaceState({}, '', window.location.pathname + '#contact'); }

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('visible');
  clearTimeout(t._timeout); t._timeout = setTimeout(() => t.classList.remove('visible'), 2500);
}

/* Dark Mode */
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') { document.body.setAttribute('data-theme', 'dark'); $('themeToggle').querySelector('i').className = 'fas fa-sun'; }
$('themeToggle').addEventListener('click', () => {
  const d = document.body.hasAttribute('data-theme');
  if (d) { document.body.removeAttribute('data-theme'); localStorage.setItem('theme', 'light'); $('themeToggle').querySelector('i').className = 'fas fa-moon'; }
  else { document.body.setAttribute('data-theme', 'dark'); localStorage.setItem('theme', 'dark'); $('themeToggle').querySelector('i').className = 'fas fa-sun'; }
});

/* Scroll to Top */
window.addEventListener('scroll', () => { window.scrollY > 400 ? scrollTop.classList.add('visible') : scrollTop.classList.remove('visible'); });
scrollTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* Testimonials */
const testimonials = [
  { name: "Fatima Ahmadi", role: "Home Buyer", text: "Alisina made finding our first home so easy. He listened to what we wanted and found the perfect place within our budget.", initial: "F" },
  { name: "Mohammad Karimi", role: "Property Seller", text: "Sold my house in just 3 weeks thanks to Alisina's marketing and negotiation skills. Got above asking price.", initial: "M" },
  { name: "Zahra Hosseini", role: "Investor", text: "I've worked with many agents over the years. Alisina stands out for his market knowledge and honest advice.", initial: "Z" },
  { name: "Ali Rezai", role: "Renter", text: "Found me a great apartment in a prime location within days. Transparent, responsive, and truly cares about his clients.", initial: "A" }
];
function renderTestimonials() {
  const g = $('testimonialsGrid');
  testimonials.forEach(t => {
    const c = document.createElement('div'); c.className = 'testimonial-card';
    c.innerHTML = `<div class="testimonial-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div><p class="testimonial-text">"${t.text}"</p><div class="testimonial-author"><div class="testimonial-avatar">${t.initial}</div><div><div class="testimonial-name">${t.name}</div><div class="testimonial-role">${t.role}</div></div></div>`;
    g.appendChild(c);
  });
}

/* Mortgage Calculator */
function fmtCurrency(v) {
  if (isNaN(v) || v < 0) v = 0;
  return `$${Math.round(v).toLocaleString()}`;
}

function calculateMortgage() {
  const price = Math.max(0, parseFloat($('calcPrice').value) || 0);
  const downPct = Math.min(100, Math.max(0, parseFloat($('calcDown').value) || 0));
  const rate = Math.max(0, parseFloat($('calcRate').value) || 0);
  const term = Math.max(1, parseInt($('calcTerm').value) || 30);
  const loan = price * (1 - downPct / 100);
  const mr = rate / 100 / 12;
  const n = term * 12;
  let pi = 0;
  if (mr > 0 && n > 0 && loan > 0) {
    const factor = Math.pow(1 + mr, n);
    pi = loan * (mr * factor) / (factor - 1);
  } else if (loan > 0) {
    pi = loan / n;
  }
  const tax = price * 0.012 / 12;
  const ins = price * 0.005 / 12;
  const total = pi + tax + ins;
  $('calcMonthly').textContent = fmtCurrency(total);
  $('calcPI').textContent = fmtCurrency(pi);
  $('calcTax').textContent = fmtCurrency(tax);
  $('calcInsurance').textContent = fmtCurrency(ins);
}
$('calcBtn').addEventListener('click', calculateMortgage);
document.querySelectorAll('#calcPrice, #calcDown, #calcRate, #calcTerm').forEach(el => { el.addEventListener('input', calculateMortgage); el.addEventListener('change', calculateMortgage); });

/* FAQ Chatbot */
const faqData = [
  { q: "How do I buy a property?", a: "First, get pre-approved for a mortgage. Then contact me to view properties that match your budget. I'll guide you through the entire process — from offer to closing." },
  { q: "What documents do I need?", a: "You'll need a valid ID, proof of income (pay stubs, tax returns), bank statements, and a pre-approval letter from a lender." },
  { q: "How much down payment is required?", a: "It varies: conventional loans typically require 5-20% down, FHA loans as low as 3.5%, and VA loans may require 0%." },
  { q: "What are the closing costs?", a: "Closing costs are typically 2-5% of the purchase price and include appraisal, inspection, title insurance, and lender fees." },
  { q: "How long does the buying process take?", a: "From offer to closing usually takes 30-45 days, depending on financing and inspections." },
  { q: "Can I rent with bad credit?", a: "Yes, some landlords accept tenants with less-than-perfect credit, especially with a larger security deposit or co-signer." },
  { q: "What properties are available?", a: "I have a wide range of properties — houses, apartments, condos, and villas. Use the search filters above to find exactly what you need!" },
  { q: "How do I schedule a viewing?", a: "Click the 'Schedule Viewing' button on any property, or use the scheduling form below. I'll confirm the appointment within 24 hours." },
  { q: "Do you help with selling too?", a: "Absolutely! I provide market analysis, professional photography, listing management, and negotiation services to get you the best price." },
  { q: "What areas do you serve?", a: "I cover all major areas. Check the listings to see available properties in your preferred location." }
];

function toggleChat() {
  $('chatBody').classList.toggle('open');
  const msgs = $('chatMsgs');
  if ($('chatBody').classList.contains('open') && msgs.children.length <= 1) {
    addBotMsg("Hi! I'm Alisina's virtual assistant. Ask me anything about buying, renting, or selling properties!");
    showFaqOptions();
  }
}

function addBotMsg(text) {
  const d = document.createElement('div'); d.className = 'chat-msg bot'; d.textContent = text;
  $('chatMsgs').appendChild(d);
  $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
}

function addUserMsg(text) {
  const d = document.createElement('div'); d.className = 'chat-msg user'; d.textContent = text;
  $('chatMsgs').appendChild(d);
  $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
}

function showFaqOptions() {
  const c = document.createElement('div'); c.className = 'chat-options';
  faqData.forEach((item, i) => {
    const b = document.createElement('button'); b.className = 'chat-option'; b.textContent = item.q;
    b.onclick = () => { addUserMsg(item.q); c.remove(); addBotMsg(item.a); showToast('FAQ answered'); setTimeout(showFaqOptions, 800); };
    c.appendChild(b);
  });
  $('chatMsgs').appendChild(c);
  $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
}

$('chatToggle').addEventListener('click', toggleChat);
$('chatClose').addEventListener('click', () => $('chatBody').classList.remove('open'));

/* Schedule Viewing */
$('scheduleForm').addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData($('scheduleForm')));
  const btn = $('scheduleForm').querySelector('.btn-submit');
  btn.textContent = 'Sending...'; btn.disabled = true;

  const sendToBackend = () => {
    return fetch(`${API_URL}/api/contact/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()).then(r => {
      if (r.success) return true;
      throw new Error(r.error || 'Failed');
    });
  };

  const sendToFormSubmit = () => {
    return fetch('https://formsubmit.co/ajax/alisinamoradi2718281@gmail.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, _subject: 'Viewing Request - Alisina Moradi Real Estate' })
    }).then(r => r.json()).then(r => {
      if (r.success) return true;
      throw new Error(r.error || 'Failed');
    });
  };

  sendToBackend()
    .catch(sendToFormSubmit)
    .then(() => { showToast('Viewing request sent! I\'ll confirm within 24 hours.'); $('scheduleForm').reset(); })
    .catch(() => showToast('Network error. Try again.'))
    .finally(() => { btn.textContent = 'Request Viewing'; btn.disabled = false; });
});

/* Property Match Quiz */
function startQuiz() {
  $('quizIntro').style.display = 'none';
  $('quizQuestions').style.display = 'block';
  showQuestion(0);
}
const quizQuestions = [
  { q: "What type of property are you looking for?", options: ["House", "Apartment", "Condo", "Villa"] },
  { q: "What's your budget range?", options: ["Under $200k", "$200k - $500k", "$500k - $1M", "$1M+"] },
  { q: "How many bedrooms do you need?", options: ["1", "2", "3", "4+"] },
  { q: "What's your preferred location?", options: ["City Center", "Suburban", "Beachfront", "Mountain/Quiet"] }
];
let quizAnswers = [];
let quizStep = 0;

function showQuestion(idx) {
  quizStep = idx;
  const q = quizQuestions[idx];
  let html = `<p class="quiz-question">${q.q}</p><div class="quiz-options">`;
  q.options.forEach((opt, i) => {
    html += `<button class="quiz-opt" onclick="answerQuiz(${i})">${opt}</button>`;
  });
  html += '</div>';
  $('quizQuestions').innerHTML = html;
}

function answerQuiz(idx) {
  quizAnswers.push({ question: quizQuestions[quizStep].q, answer: quizQuestions[quizStep].options[idx] });
  if (quizStep < quizQuestions.length - 1) {
    showQuestion(quizStep + 1);
  } else {
    showQuizResult();
  }
}

function showQuizResult() {
  const typeMap = { "House": "house", "Apartment": "apartment", "Condo": "condo", "Villa": "villa" };
  const priceMap = { "Under $200k": "0-200000", "$200k - $500k": "200000-500000", "$500k - $1M": "500000-1000000", "$1M+": "1000000-999999999" };
  const type = typeMap[quizAnswers[0]?.answer] || '';
  const price = priceMap[quizAnswers[1]?.answer] || '';
  const bedsNeeded = parseInt(quizAnswers[2]?.answer) || 0;
  const matched = properties.filter(p => (!type || p.type === type) && (!price || matchesPrice(p.price, price)) && p.beds >= bedsNeeded);
  let html = '<p class="quiz-result-title">Based on your answers:</p>';
  if (matched.length === 0) html += '<p class="quiz-result-text">No exact matches found. Let me help you find something close — contact me directly!</p>';
  else html += `<p class="quiz-result-text">Found ${matched.length} matching propert${matched.length > 1 ? 'ies' : 'y'}!</p><div class="quiz-matches">`;
  matched.slice(0, 3).forEach(p => {
    html += `<div class="quiz-match" onclick="openModal(properties.find(x => x.id === ${p.id}))">
      <img src="${p.image}" alt="${p.title}"><div><strong>${p.title}</strong><br>${formatPrice(p.price, p.badge)} | ${p.beds} bed | ${p.location}</div>
    </div>`;
  });
  html += '</div><button class="btn-search" onclick="resetQuiz()">Try Again</button>';
  $('quizQuestions').innerHTML = html;
}

function resetQuiz() {
  quizAnswers = []; quizStep = 0;
  $('quizIntro').style.display = 'block';
  $('quizIntro').innerHTML = `<h3>Find Your Perfect Property</h3><p>Answer 4 quick questions and I'll match you with the best properties.</p><button class="btn-search" onclick="startQuiz()">Start Quiz</button>`;
  $('quizQuestions').style.display = 'none';
}

/* Map */
function createMapIcon(p) {
  const color = p.badge === 'sale' ? '#1a73e8' : '#059669';
  const label = formatPrice(p.price, p.badge);
  return L.divIcon({
    className: 'map-marker',
    html: `<div class="map-marker-inner" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [0, 0],
    popupAnchor: [0, -10]
  });
}

function createPopupContent(p) {
  const popup = document.createElement('div');
  popup.className = 'map-popup';
  popup.innerHTML = `
    <div class="map-popup-img"><img src="${p.image}" alt="${p.title}" loading="lazy"></div>
    <div class="map-popup-body">
      <div class="map-popup-price">${formatPrice(p.price, p.badge)}</div>
      <div class="map-popup-title">${p.title}</div>
      <div class="map-popup-location"><i class="fas fa-map-marker-alt"></i> ${p.location}</div>
      <div class="map-popup-features">
        <span><i class="fas fa-bed"></i> ${p.beds}</span>
        <span><i class="fas fa-bath"></i> ${p.baths}</span>
        <span><i class="fas fa-ruler-combined"></i> ${p.sqft.toLocaleString()} sqft</span>
      </div>
      <button class="map-popup-btn" data-id="${p.id}">View Details</button>
    </div>`;
  popup.querySelector('.map-popup-btn').addEventListener('click', () => openModal(p));
  return popup;
}

function initMap() {
  const el = document.getElementById('propertyMap');
  if (typeof L === 'undefined' || !el) return;
  if (el._leaflet_id) return;

  const isDark = document.body.hasAttribute('data-theme');
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

  const map = L.map(el, { zoomControl: false }).setView([39.8283, -98.5795], 4);
  L.tileLayer(tileUrl, { attribution: attr, maxZoom: 20 }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const markers = [];
  const bounds = [];

  properties.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { icon: createMapIcon(p) }).addTo(map);
    const popupEl = createPopupContent(p);
    marker.bindPopup(popupEl, { maxWidth: 320, className: 'map-popup-wrapper', closeButton: true });
    markers.push(marker);
    bounds.push([p.lat, p.lng]);

    marker.on('mouseover', () => marker.setZIndexOffset(1000));
    marker.on('mouseout', () => marker.setZIndexOffset(0));
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
  }

  /* Sync with property cards */
  document.querySelectorAll('.property-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const id = Number(card.dataset.id);
      const m = markers.find((_, i) => properties[i].id === id);
      if (m) {
        map.flyTo(m.getLatLng(), 10, { duration: 0.6 });
        m.setZIndexOffset(1000);
        setTimeout(() => { if (m._icon) m._icon.style.transform += ' scale(1.3)'; }, 100);
      }
    });
    card.addEventListener('mouseleave', () => {
      markers.forEach(m => m.setZIndexOffset(0));
      markers.forEach(m => { if (m._icon) m._icon.style.transform = m._icon.style.transform.replace(' scale(1.3)', ''); });
      if (bounds.length) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12, duration: 0.6 });
    });
  });

  /* Re-theme on dark mode toggle */
  const observer = new MutationObserver(() => {
    const dark = document.body.hasAttribute('data-theme');
    const newUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
        L.tileLayer(newUrl, { attribution: attr, maxZoom: 20 }).addTo(map);
      }
    });
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}

function tryInitMap() {
  if (typeof L !== 'undefined') { initMap(); return; }
  const interval = setInterval(() => {
    if (typeof L !== 'undefined') { clearInterval(interval); initMap(); }
  }, 200);
  setTimeout(() => clearInterval(interval), 10000);
}

/* User Auth */
let userToken = localStorage.getItem('user_token');
let currentUser = JSON.parse(localStorage.getItem('user_data') || 'null');

function updateUserUI() {
  const loggedOut = document.getElementById('userMenuLoggedOut');
  const loggedIn = document.getElementById('userMenuLoggedIn');
  const userBtn = document.getElementById('userBtn');
  if (currentUser) {
    loggedOut.style.display = 'none';
    loggedIn.style.display = 'block';
    document.getElementById('userMenuName').textContent = currentUser.name;
    document.getElementById('userMenuEmail').textContent = currentUser.email;
    userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
  } else {
    loggedOut.style.display = 'block';
    loggedIn.style.display = 'none';
    userBtn.innerHTML = '<i class="far fa-user"></i>';
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.classList.toggle('open');
}

document.addEventListener('click', e => {
  const menu = document.getElementById('userMenu');
  if (!e.target.closest('#userBtn') && !e.target.closest('#userMenu')) {
    menu.classList.remove('open');
  }
});

let authMode = 'login';
function showAuthModal(mode) {
  authMode = mode;
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('authError').textContent = '';
  if (mode === 'login') {
    document.getElementById('authModalTitle').textContent = 'Sign In';
    document.getElementById('authModalSub').textContent = 'Welcome back!';
    document.getElementById('authBtn').textContent = 'Sign In';
    document.getElementById('authToggleText').textContent = "Don't have an account?";
    document.getElementById('authToggleLink').textContent = 'Register';
    document.getElementById('authNameField').style.display = 'none';
  } else {
    document.getElementById('authModalTitle').textContent = 'Create Account';
    document.getElementById('authModalSub').textContent = 'Join to save favorites!';
    document.getElementById('authBtn').textContent = 'Create Account';
    document.getElementById('authToggleText').textContent = 'Already have an account?';
    document.getElementById('authToggleLink').textContent = 'Sign In';
    document.getElementById('authNameField').style.display = 'block';
  }
}

function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }
document.getElementById('authModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });

function toggleAuthMode() {
  showAuthModal(authMode === 'login' ? 'register' : 'login');
}

document.getElementById('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const err = document.getElementById('authError');
  const btn = document.getElementById('authBtn');

  if (authMode === 'register') {
    const name = document.getElementById('authName').value;
    if (!name) { err.textContent = 'Name is required'; return; }
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const res = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      userToken = data.token; currentUser = data.user;
      localStorage.setItem('user_token', userToken);
      localStorage.setItem('user_data', JSON.stringify(currentUser));
      updateUserUI(); closeAuthModal(); showToast('Account created! Welcome ' + data.user.name);
    } catch (e) { err.textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = 'Create Account'; }
  } else {
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const res = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      userToken = data.token; currentUser = data.user;
      localStorage.setItem('user_token', userToken);
      localStorage.setItem('user_data', JSON.stringify(currentUser));
      updateUserUI(); closeAuthModal(); showToast('Welcome back, ' + data.user.name + '!');
      syncFavoritesFromServer();
    } catch (e) { err.textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
});

function logoutUser() {
  userToken = null; currentUser = null;
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_data');
  document.getElementById('userMenu').classList.remove('open');
  updateUserUI();
  favorites.clear();
  localStorage.setItem('favs', '[]');
  updateListings();
  showToast('Signed out');
}

async function syncFavoritesFromServer() {
  if (!userToken) return;
  try {
      const res = await fetch(`${API_URL}/api/users/favorites`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
    const ids = await res.json();
    favorites = new Set(ids);
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    updateListings();
  } catch {}
}

/* Gallery Carousel */
function initCarousel(modalImageEl, images) {
  if (!images || images.length === 0) return;
  let current = 0;
  modalImageEl.innerHTML = `
    <div class="carousel" style="position:relative;width:100%;height:100%">
      <img src="${images[0]}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
      ${images.length > 1 ? `
        <button class="carousel-btn carousel-prev" onclick="carouselMove(-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;z-index:5;font-size:18px;display:flex;align-items:center;justify-content:center"><i class="fas fa-chevron-left"></i></button>
        <button class="carousel-btn carousel-next" onclick="carouselMove(1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;z-index:5;font-size:18px;display:flex;align-items:center;justify-content:center"><i class="fas fa-chevron-right"></i></button>
        <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;padding:2px 12px;border-radius:12px;font-size:12px;z-index:5" id="carouselCounter">1 / ${images.length}</div>
      ` : ''}
    </div>`;
  window._carouselImages = images;
  window._carouselImg = modalImageEl.querySelector('img');
}

function carouselMove(dir) {
  const images = window._carouselImages;
  const img = window._carouselImg;
  if (!images || !img) return;
  let current = images.indexOf(img.src);
  if (current === -1) current = 0;
  current = (current + dir + images.length) % images.length;
  img.src = images[current];
  const counter = document.getElementById('carouselCounter');
  if (counter) counter.textContent = `${current + 1} / ${images.length}`;
}

/* Override openModal for gallery */
const _origOpenModal = openModal;
openModal = function(p) {
  _origOpenModal(p);
  const images = p.gallery && p.gallery.length > 0 ? p.gallery : (p.image ? [p.image] : []);
  initCarousel($('modalImage'), images);
};

/* Override setFavIcon to sync with server */
const _origSetFavIcon = setFavIcon;
setFavIcon = function(btn, id) {
  _origSetFavIcon(btn, id);
  if (userToken && currentUser) {
    fetch(`${API_URL}/api/users/favorites/${id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' }
    }).catch(() => {});
  }
};

/* Blog */
async function loadBlogPosts() {
  try {
    const res = await fetch(`${API_URL}/api/blog`);
    if (!res.ok) return;
    const posts = await res.json();
    const grid = document.getElementById('blogGrid');
    if (!posts.length) { grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px">No posts yet. Check back soon!</p>'; return; }
    grid.innerHTML = posts.slice(0, 3).map(p => `
      <div class="blog-card">
        ${p.image ? `<div class="blog-image"><img src="${p.image}" alt="${p.title}" loading="lazy"></div>` : ''}
        <div class="blog-body">
          <div class="blog-date">${p.created_at?.split(' ')[0] || ''}</div>
          <h3 class="blog-title">${p.title}</h3>
          <p class="blog-excerpt">${p.excerpt || ''}</p>
          <span class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></span>
        </div>
      </div>
    `).join('');
  } catch {}
}

/* Update favorites toggle — save to server if logged in */
const _origFavToggle = function(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem('favs', JSON.stringify([...favorites]));
};
/* Patch the fav click in listingsGrid handler */
renderTestimonials();
calculateMortgage();
resetQuiz();
updateListings();
loadPropertiesFromApi();
tryInitMap();
loadBlogPosts();
updateUserUI();
if (userToken) syncFavoritesFromServer();
