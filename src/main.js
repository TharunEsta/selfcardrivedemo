import './styles.css';

const STORAGE_KEYS = {
  visitor: 'premium-self-drive-visitor',
  bookings: 'premium-self-drive-bookings',
  admin: 'premium-self-drive-admin-queue'
};

const vehicles = [
  {
    id: 'swift',
    name: 'Maruti Suzuki Swift',
    tag: 'Sport Hatch',
    video: '/media/swift.mp4',
    accent: '#d74b58'
  },
  {
    id: 'innova',
    name: 'Toyota Innova Crysta',
    tag: 'Luxury MPV',
    video: '/media/innova.mp4',
    accent: '#8fa6c8'
  }
];

const timeSlots = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00'
];

const state = {
  activeVideo: 0,
  visitor: loadVisitor(),
  bookings: cleanupBookings(loadJson(STORAGE_KEYS.bookings, [])),
  adminQueue: cleanupBookings(loadJson(STORAGE_KEYS.admin, [])),
  selectedVehicle: vehicles[0].id,
  selectedDate: '',
  selectedFrom: '09:00',
  selectedTo: '12:00',
  selectedLead: null,
  availabilityChecked: false
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadVisitor() {
  return loadJson(STORAGE_KEYS.visitor, {
    name: '',
    email: '',
    phone: '',
    loggedIn: false
  });
}

function cleanupBookings(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return items.filter((item) => {
    const end = new Date(`${item.date}T${item.to}:00`);
    return Number.isFinite(end.getTime()) && end >= today;
  });
}

function persistState() {
  saveJson(STORAGE_KEYS.bookings, state.bookings);
  saveJson(STORAGE_KEYS.admin, state.adminQueue);
  saveJson(STORAGE_KEYS.visitor, state.visitor);
}

function getDateOptions() {
  const dates = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < 60; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateString));
}

function formatTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function getAvailability() {
  if (!state.availabilityChecked) {
    return { valid: false, message: 'Login, choose date and time, then click Check availability.' };
  }

  if (!state.selectedDate || !state.selectedFrom || !state.selectedTo) {
    return { valid: false, message: 'Select a date and time window to check availability.' };
  }

  const fromMinutes = timeToMinutes(state.selectedFrom);
  const toMinutes = timeToMinutes(state.selectedTo);

  if (toMinutes <= fromMinutes) {
    return { valid: false, busy: true, message: 'Choose an end time later than the start time.' };
  }

  const hasConflict = state.bookings.some((booking) => {
    if (booking.vehicle !== state.selectedVehicle || booking.date !== state.selectedDate) {
      return false;
    }

    const bookingFrom = timeToMinutes(booking.from);
    const bookingTo = timeToMinutes(booking.to);
    return fromMinutes < bookingTo && toMinutes > bookingFrom;
  });

  if (hasConflict) {
    return {
      valid: true,
      busy: true,
      message: 'This date and time is not available. It is already booked.'
    };
  }

  return {
    valid: true,
    busy: false,
    message: 'This slot is free. Continue to share trip details.'
  };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function render() {
  const availability = getAvailability();
  const dateOptions = getDateOptions();
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === state.selectedVehicle) || vehicles[0];

  document.querySelector('#app').innerHTML = `
    <div class="page-shell">
      <section class="hero-panel">
        <div class="hero-topbar">
          <div>
            <p class="eyebrow">Premium Self Drive</p>
            <h1>Luxury booking flow with cinematic vehicle previews.</h1>
          </div>
          <button class="admin-link" data-action="toggle-admin" type="button">Admin desk</button>
        </div>

        <div class="video-stage">
          <video
            id="hero-video"
            class="hero-video"
            src="${vehicles[state.activeVideo].video}"
            muted
            autoplay
            playsinline
          ></video>
          <div class="video-overlay">
            <p class="eyebrow">Now Showing</p>
            <h2>${vehicles[state.activeVideo].name}</h2>
            <p>${vehicles[state.activeVideo].tag} preview playing in sequence. The next vehicle starts automatically.</p>
          </div>
          <div class="video-pills">
            ${vehicles
              .map(
                (vehicle, index) => `
                  <button
                    class="video-pill ${index === state.activeVideo ? 'active' : ''}"
                    data-action="switch-video"
                    data-video-index="${index}"
                    type="button"
                  >
                    <span>${vehicle.name}</span>
                    <small>${vehicle.tag}</small>
                  </button>
                `
              )
              .join('')}
          </div>
        </div>

        <div class="hero-copy">
          <div class="hero-card">
            <span>Sequential showcase</span>
            <strong>Swift and Innova animations now play one after another.</strong>
          </div>
          <div class="hero-card">
            <span>Live slot check</span>
            <strong>Users see instantly whether a date and time range is free or already booked.</strong>
          </div>
          <div class="hero-card">
            <span>2 month rolling window</span>
            <strong>Yesterday’s bookings fall away automatically, so the calendar refreshes daily.</strong>
          </div>
        </div>
      </section>

      <section class="booking-panel">
        <div class="booking-header">
          <div>
            <p class="eyebrow">Book Like BookMyShow</p>
            <h2>Reserve a self-drive slot without payment.</h2>
          </div>
          <p class="booking-note">The admin receives the booking lead with customer details, then contacts them with pickup, drop, and pricing.</p>
        </div>

        <div class="flow-card">
          <div class="step-header">
            <span class="step-number">1</span>
            <div>
              <h3>Visitor login</h3>
              <p>Login first, then choose your car, date, and time range.</p>
            </div>
          </div>
          <form id="login-form" class="form-grid">
            <label>
              <span>Full name</span>
              <input name="name" type="text" placeholder="Your full name" value="${escapeHtml(state.visitor.name)}" required />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" placeholder="name@email.com" value="${escapeHtml(state.visitor.email)}" required />
            </label>
            <label class="full-width">
              <span>Phone</span>
              <input name="phone" type="tel" placeholder="+91 98xxxxxxx" value="${escapeHtml(state.visitor.phone)}" required />
            </label>
            <button class="primary-button full-width" type="submit">
              ${state.visitor.loggedIn ? 'Update visitor profile' : 'Login to continue'}
            </button>
          </form>
        </div>

        <div class="flow-card ${state.visitor.loggedIn ? '' : 'disabled-card'}">
          <div class="step-header">
            <span class="step-number">2</span>
            <div>
              <h3>Select vehicle, date, and time</h3>
              <p>Availability is checked live for the next 60 days.</p>
            </div>
          </div>
          <form id="availability-form" class="form-grid">
            <label class="full-width">
              <span>Vehicle</span>
              <select name="vehicle" ${state.visitor.loggedIn ? '' : 'disabled'}>
                ${vehicles
                  .map(
                    (vehicle) => `
                      <option value="${vehicle.id}" ${vehicle.id === state.selectedVehicle ? 'selected' : ''}>
                        ${vehicle.name}
                      </option>
                    `
                  )
                  .join('')}
              </select>
            </label>
            <label>
              <span>Date</span>
              <select name="date" ${state.visitor.loggedIn ? '' : 'disabled'}>
                <option value="">Choose date</option>
                ${dateOptions
                  .map(
                    (date) => `
                      <option value="${date}" ${date === state.selectedDate ? 'selected' : ''}>
                        ${formatDate(date)}
                      </option>
                    `
                  )
                  .join('')}
              </select>
            </label>
            <label>
              <span>From</span>
              <select name="from" ${state.visitor.loggedIn ? '' : 'disabled'}>
                ${timeSlots
                  .map(
                    (slot) => `
                      <option value="${slot}" ${slot === state.selectedFrom ? 'selected' : ''}>
                        ${formatTime(slot)}
                      </option>
                    `
                  )
                  .join('')}
              </select>
            </label>
            <label>
              <span>Upto</span>
              <select name="to" ${state.visitor.loggedIn ? '' : 'disabled'}>
                ${timeSlots
                  .map(
                    (slot) => `
                      <option value="${slot}" ${slot === state.selectedTo ? 'selected' : ''}>
                        ${formatTime(slot)}
                      </option>
                    `
                  )
                  .join('')}
              </select>
            </label>
            <button class="primary-button full-width" type="submit" ${state.visitor.loggedIn ? '' : 'disabled'}>
              Check availability
            </button>
          </form>

          <div class="availability-banner ${availability.busy ? 'busy' : availability.valid ? 'free' : ''}">
            <strong>${availability.busy ? 'Unavailable' : availability.valid ? 'Available' : 'Waiting for selection'}</strong>
            <span>${availability.message}</span>
          </div>

          <div class="selection-summary">
            <span>Selected car</span>
            <strong>${selectedVehicle.name}</strong>
            <span>Selected window</span>
            <strong>${state.selectedDate ? `${formatDate(state.selectedDate)}, ${formatTime(state.selectedFrom)} to ${formatTime(state.selectedTo)}` : 'Not selected yet'}</strong>
          </div>
        </div>

        <div class="flow-card ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled-card'}">
          <div class="step-header">
            <span class="step-number">3</span>
            <div>
              <h3>Trip details for admin follow-up</h3>
              <p>Shown only when the chosen slot is free.</p>
            </div>
          </div>
          <form id="details-form" class="form-grid">
            <label>
              <span>Pickup location</span>
              <input name="pickup" type="text" placeholder="Pickup area" ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'} required />
            </label>
            <label>
              <span>Drop location</span>
              <input name="drop" type="text" placeholder="Drop area" ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'} required />
            </label>
            <label class="full-width">
              <span>Trip notes</span>
              <textarea name="notes" rows="4" placeholder="Tell the admin anything helpful about your trip." ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'}></textarea>
            </label>
            <button class="primary-button full-width" type="submit" ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'}>
              Submit booking request
            </button>
          </form>
        </div>

        ${
          state.selectedLead
            ? `
              <div class="success-card">
                <p class="eyebrow">Request sent</p>
                <h3>${escapeHtml(state.selectedLead.name)}, your booking lead is now in the admin queue.</h3>
                <p>
                  ${selectedVehicle.name} on ${formatDate(state.selectedLead.date)} from
                  ${formatTime(state.selectedLead.from)} to ${formatTime(state.selectedLead.to)}.
                  The admin can now contact you for pickup, drop, and price confirmation.
                </p>
              </div>
            `
            : ''
        }
      </section>
    </div>

    <aside class="admin-drawer" id="admin-drawer" hidden>
      <div class="admin-header">
        <div>
          <p class="eyebrow">Admin queue</p>
          <h2>New booking follow-ups</h2>
        </div>
        <button class="admin-close" data-action="close-admin" type="button">Close</button>
      </div>
      <div class="admin-list">
        ${
          state.adminQueue.length
            ? state.adminQueue
                .slice()
                .reverse()
                .map(
                  (lead) => `
                    <article class="admin-item">
                      <div class="admin-item-top">
                        <strong>${escapeHtml(lead.name)}</strong>
                        <span>${formatDate(lead.date)} | ${formatTime(lead.from)} to ${formatTime(lead.to)}</span>
                      </div>
                      <p>${escapeHtml(lead.vehicleName)}</p>
                      <p>Email: ${escapeHtml(lead.email)}</p>
                      <p>Phone: ${escapeHtml(lead.phone)}</p>
                      <p>Pickup: ${escapeHtml(lead.pickup)}</p>
                      <p>Drop: ${escapeHtml(lead.drop)}</p>
                      <p>Notes: ${escapeHtml(lead.notes || 'No notes')}</p>
                    </article>
                  `
                )
                .join('')
            : '<p class="empty-state">No active booking leads in the current 2 month window.</p>'
        }
      </div>
    </aside>
  `;

  attachEvents();
}

function attachEvents() {
  const heroVideo = document.querySelector('#hero-video');
  if (heroVideo) {
    heroVideo.currentTime = 0;
    heroVideo.play().catch(() => {});
    heroVideo.addEventListener('ended', () => {
      state.activeVideo = (state.activeVideo + 1) % vehicles.length;
      render();
    });
  }

  document.querySelectorAll('[data-action="switch-video"]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.videoIndex);
      state.activeVideo = index;
      state.selectedVehicle = vehicles[index]?.id || vehicles[0].id;
      state.availabilityChecked = false;
      state.selectedLead = null;
      render();
    });
  });

  document.querySelector('[data-action="toggle-admin"]')?.addEventListener('click', () => {
    document.querySelector('#admin-drawer')?.removeAttribute('hidden');
    document.body.classList.add('admin-open');
  });

  document.querySelector('[data-action="close-admin"]')?.addEventListener('click', () => {
    document.querySelector('#admin-drawer')?.setAttribute('hidden', 'hidden');
    document.body.classList.remove('admin-open');
  });

  document.querySelector('#login-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.visitor = {
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      loggedIn: true
    };
    state.availabilityChecked = false;
    persistState();
    render();
  });

  document.querySelector('#availability-form')?.addEventListener('change', (event) => {
    const form = new FormData(event.currentTarget);
    state.selectedVehicle = String(form.get('vehicle') || vehicles[0].id);
    state.selectedDate = String(form.get('date') || '');
    state.selectedFrom = String(form.get('from') || '09:00');
    state.selectedTo = String(form.get('to') || '12:00');
    const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.id === state.selectedVehicle);
    state.activeVideo = vehicleIndex >= 0 ? vehicleIndex : 0;
    state.availabilityChecked = false;
    state.selectedLead = null;
    render();
  });

  document.querySelector('#availability-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.selectedVehicle = String(form.get('vehicle') || vehicles[0].id);
    state.selectedDate = String(form.get('date') || '');
    state.selectedFrom = String(form.get('from') || '09:00');
    state.selectedTo = String(form.get('to') || '12:00');
    const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.id === state.selectedVehicle);
    state.activeVideo = vehicleIndex >= 0 ? vehicleIndex : 0;
    state.availabilityChecked = true;
    state.selectedLead = null;
    render();
  });

  document.querySelector('#details-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const availability = getAvailability();
    if (availability.busy || !availability.valid) {
      render();
      return;
    }

    const form = new FormData(event.currentTarget);
    const vehicle = vehicles.find((item) => item.id === state.selectedVehicle) || vehicles[0];
    const lead = {
      id: `lead-${Date.now()}`,
      vehicle: vehicle.id,
      vehicleName: vehicle.name,
      date: state.selectedDate,
      from: state.selectedFrom,
      to: state.selectedTo,
      pickup: String(form.get('pickup') || '').trim(),
      drop: String(form.get('drop') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      name: state.visitor.name,
      email: state.visitor.email,
      phone: state.visitor.phone,
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    state.bookings.push(lead);
    state.adminQueue.push(lead);
    state.selectedLead = lead;
    persistState();
    render();
  });
}

persistState();
render();
