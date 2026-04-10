import './styles.css';

const STORAGE_KEYS = {
  visitor: 'premium-self-drive-visitor',
  bookings: 'premium-self-drive-bookings',
  admin: 'premium-self-drive-admin-queue',
  adminAuth: 'premium-self-drive-admin-auth'
};

const DEFAULT_ADMIN_PASSWORD = 'Phani@123';

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
  availabilityChecked: false,
  detailsDraft: {
    pickup: '',
    drop: '',
    notes: ''
  },
  showSqlExport: false,
  showAdminDrawer: false,
  showAdminAuth: false,
  adminAuth: loadAdminAuth(),
  adminForm: {
    name: '',
    password: '',
    confirmPassword: ''
  },
  adminLoginPassword: '',
  adminMessage: ''
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

const bookingStore = {
  loadVisitor() {
    return loadJson(STORAGE_KEYS.visitor, {
      name: '',
      email: '',
      phone: '',
      loggedIn: false
    });
  },
  loadBookings() {
    return cleanupBookings(loadJson(STORAGE_KEYS.bookings, []));
  },
  loadAdminQueue() {
    return cleanupBookings(loadJson(STORAGE_KEYS.admin, []));
  },
  save(visitor, bookings, adminQueue) {
    saveJson(STORAGE_KEYS.bookings, bookings);
    saveJson(STORAGE_KEYS.admin, adminQueue);
    saveJson(STORAGE_KEYS.visitor, visitor);
  }
};

function loadVisitor() {
  return bookingStore.loadVisitor();
}

function loadAdminAuth() {
  return loadJson(STORAGE_KEYS.adminAuth, {
    registered: false,
    name: '',
    password: DEFAULT_ADMIN_PASSWORD,
    faceIdEnabled: false,
    faceIdCredentialId: ''
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
  bookingStore.save(state.visitor, state.bookings, state.adminQueue);
  saveJson(STORAGE_KEYS.adminAuth, state.adminAuth);
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

function formatShortDate(dateString) {
  const date = new Date(dateString);
  return {
    weekday: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
    day: new Intl.DateTimeFormat('en-IN', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date)
  };
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

function escapeSql(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function isFaceIdSupported() {
  return (
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined' &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

function toBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function randomBuffer(size = 32) {
  const buffer = new Uint8Array(size);
  crypto.getRandomValues(buffer);
  return buffer;
}

async function registerFaceId() {
  const userId = randomBuffer(16);
  const challenge = randomBuffer(32);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Self Drive Admin Desk' },
      user: {
        id: userId,
        name: state.adminAuth.name || 'admin@selfdrive.local',
        displayName: state.adminAuth.name || 'Admin'
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required'
      },
      timeout: 60000,
      attestation: 'none'
    }
  });

  const rawId = credential?.rawId ? toBase64Url(credential.rawId) : '';
  if (!rawId) {
    throw new Error('Face ID registration failed.');
  }

  state.adminAuth.faceIdEnabled = true;
  state.adminAuth.faceIdCredentialId = rawId;
  persistState();
}

async function loginWithFaceId() {
  const challenge = randomBuffer(32);
  await navigator.credentials.get({
    publicKey: {
      challenge,
      userVerification: 'required',
      timeout: 60000
    }
  });

  state.showAdminAuth = false;
  state.showAdminDrawer = true;
  state.adminMessage = 'Face ID verified.';
  render();
}

function buildSqlExport(rows) {
  if (!rows.length) {
    return '-- No active booking leads to export.';
  }

  return [
    '-- Booking lead export',
    ...rows.map(
      (lead) => `INSERT INTO booking_leads (
  id, vehicle_id, vehicle_name, booking_date, time_from, time_to,
  customer_name, customer_email, customer_phone, pickup_location,
  drop_location, trip_notes, created_at, status
) VALUES (
  '${escapeSql(lead.id)}',
  '${escapeSql(lead.vehicle)}',
  '${escapeSql(lead.vehicleName)}',
  '${escapeSql(lead.date)}',
  '${escapeSql(lead.from)}',
  '${escapeSql(lead.to)}',
  '${escapeSql(lead.name)}',
  '${escapeSql(lead.email)}',
  '${escapeSql(lead.phone)}',
  '${escapeSql(lead.pickup)}',
  '${escapeSql(lead.drop)}',
  '${escapeSql(lead.notes || '')}',
  '${escapeSql(lead.createdAt)}',
  '${escapeSql(lead.status)}'
);`
    )
  ].join('\n\n');
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
            <input name="vehicle" type="hidden" value="${state.selectedVehicle}" />
            <input name="date" type="hidden" value="${state.selectedDate}" />
            <input name="from" type="hidden" value="${state.selectedFrom}" />
            <input name="to" type="hidden" value="${state.selectedTo}" />

            <div class="picker-group full-width">
              <span class="picker-label">Vehicle</span>
              <div class="choice-grid two-up">
                ${vehicles
                  .map(
                    (vehicle) => `
                      <button
                        class="choice-pill ${vehicle.id === state.selectedVehicle ? 'active' : ''}"
                        data-action="pick-vehicle"
                        data-vehicle="${vehicle.id}"
                        type="button"
                        ${state.visitor.loggedIn ? '' : 'disabled'}
                      >
                        <strong>${vehicle.name}</strong>
                        <small>${vehicle.tag}</small>
                      </button>
                    `
                  )
                  .join('')}
              </div>
            </div>

            <div class="picker-group full-width">
              <span class="picker-label">Date</span>
              <div class="calendar-grid">
                ${dateOptions
                  .map((date) => {
                    const parts = formatShortDate(date);
                    return `
                      <button
                        class="date-card ${date === state.selectedDate ? 'active' : ''}"
                        data-action="pick-date"
                        data-date="${date}"
                        type="button"
                        ${state.visitor.loggedIn ? '' : 'disabled'}
                      >
                        <small>${parts.weekday}</small>
                        <strong>${parts.day}</strong>
                        <span>${parts.month}</span>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            </div>

            <div class="picker-group">
              <span class="picker-label">From</span>
              <div class="choice-grid">
                ${timeSlots
                  .map(
                    (slot) => `
                      <button
                        class="time-pill ${slot === state.selectedFrom ? 'active' : ''}"
                        data-action="pick-from"
                        data-time="${slot}"
                        type="button"
                        ${state.visitor.loggedIn ? '' : 'disabled'}
                      >
                        ${formatTime(slot)}
                      </button>
                    `
                  )
                  .join('')}
              </div>
            </div>

            <div class="picker-group">
              <span class="picker-label">Upto</span>
              <div class="choice-grid">
                ${timeSlots
                  .map(
                    (slot) => `
                      <button
                        class="time-pill ${slot === state.selectedTo ? 'active' : ''}"
                        data-action="pick-to"
                        data-time="${slot}"
                        type="button"
                        ${state.visitor.loggedIn ? '' : 'disabled'}
                      >
                        ${formatTime(slot)}
                      </button>
                    `
                  )
                  .join('')}
              </div>
            </div>

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
              <input name="pickup" type="text" placeholder="Pickup area" value="${escapeHtml(state.detailsDraft.pickup)}" ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'} required />
            </label>
            <label>
              <span>Drop location</span>
              <input name="drop" type="text" placeholder="Drop area" value="${escapeHtml(state.detailsDraft.drop)}" ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'} required />
            </label>
            <label class="full-width">
              <span>Trip notes</span>
              <textarea name="notes" rows="4" placeholder="Tell the admin anything helpful about your trip." ${state.visitor.loggedIn && availability.valid && !availability.busy ? '' : 'disabled'}>${escapeHtml(state.detailsDraft.notes)}</textarea>
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

    <aside class="admin-drawer" id="admin-drawer" ${state.showAdminDrawer ? '' : 'hidden'}>
      <div class="admin-header">
        <div>
          <p class="eyebrow">Admin queue</p>
          <h2>New booking follow-ups</h2>
        </div>
        <div class="admin-actions">
          <button class="admin-close" data-action="toggle-sql" type="button">SQL export</button>
          <button class="admin-close" data-action="close-admin" type="button">Close</button>
        </div>
      </div>
      ${
        state.showSqlExport
          ? `
            <div class="sql-panel">
              <p class="eyebrow">Frontend SQL</p>
              <p class="booking-note">This app still runs in the browser, but you can copy these SQL statements into any SQL database later.</p>
              <textarea class="sql-output" readonly>${escapeHtml(buildSqlExport(state.adminQueue))}</textarea>
            </div>
          `
          : ''
      }
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

    ${
      state.showAdminAuth
        ? `
          <div class="auth-overlay">
            <section class="auth-card">
              <p class="eyebrow">Protected Admin Desk</p>
              <h2>${state.adminAuth.registered ? 'Admin login required' : 'Admin registration required'}</h2>
              <p class="booking-note">
                ${state.adminAuth.registered
                  ? 'Enter the admin password first. On supported iPhones, you can also unlock with Face ID after setup.'
                  : 'Register the admin account first, then optionally enable Face ID for iPhone access.'}
              </p>
              ${state.adminMessage ? `<div class="availability-banner"><span>${escapeHtml(state.adminMessage)}</span></div>` : ''}

              ${
                state.adminAuth.registered
                  ? `
                    <form id="admin-login-form" class="form-grid">
                      <label class="full-width">
                        <span>Admin password</span>
                        <input name="password" type="password" placeholder="Enter admin password" value="${escapeHtml(state.adminLoginPassword)}" required />
                      </label>
                      <button class="primary-button full-width" type="submit">Unlock admin desk</button>
                    </form>
                    ${
                      state.adminAuth.faceIdEnabled && isFaceIdSupported()
                        ? '<button class="admin-close auth-faceid" data-action="faceid-login" type="button">Unlock with Face ID</button>'
                        : ''
                    }
                    ${
                      !state.adminAuth.faceIdEnabled && isFaceIdSupported()
                        ? '<button class="admin-close auth-faceid" data-action="faceid-register" type="button">Add Face ID</button>'
                        : ''
                    }
                  `
                  : `
                    <form id="admin-register-form" class="form-grid">
                      <label class="full-width">
                        <span>Admin name</span>
                        <input name="name" type="text" placeholder="Admin name" value="${escapeHtml(state.adminForm.name)}" required />
                      </label>
                      <label>
                        <span>Password</span>
                        <input name="password" type="password" value="${escapeHtml(state.adminForm.password || DEFAULT_ADMIN_PASSWORD)}" required />
                      </label>
                      <label>
                        <span>Confirm password</span>
                        <input name="confirmPassword" type="password" value="${escapeHtml(state.adminForm.confirmPassword || DEFAULT_ADMIN_PASSWORD)}" required />
                      </label>
                      <button class="primary-button full-width" type="submit">Register admin</button>
                    </form>
                  `
              }

              <button class="admin-close full-width" data-action="close-auth" type="button">Close</button>
            </section>
          </div>
        `
        : ''
    }
  `;

  attachEvents();
}

function attachEvents() {
  const heroVideo = document.querySelector('#hero-video');
  if (heroVideo) {
    heroVideo.currentTime = 0;
    heroVideo.play().catch(() => {});
    heroVideo.addEventListener('ended', () => {
      if (document.querySelector('input:focus, select:focus, textarea:focus')) {
        heroVideo.currentTime = 0;
        heroVideo.play().catch(() => {});
        return;
      }
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

  document.querySelectorAll('[data-action="pick-vehicle"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedVehicle = button.dataset.vehicle || vehicles[0].id;
      const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.id === state.selectedVehicle);
      state.activeVideo = vehicleIndex >= 0 ? vehicleIndex : 0;
      state.availabilityChecked = false;
      state.selectedLead = null;
      render();
    });
  });

  document.querySelectorAll('[data-action="pick-date"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDate = button.dataset.date || '';
      state.availabilityChecked = false;
      state.selectedLead = null;
      render();
    });
  });

  document.querySelectorAll('[data-action="pick-from"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedFrom = button.dataset.time || '09:00';
      state.availabilityChecked = false;
      state.selectedLead = null;
      render();
    });
  });

  document.querySelectorAll('[data-action="pick-to"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTo = button.dataset.time || '12:00';
      state.availabilityChecked = false;
      state.selectedLead = null;
      render();
    });
  });

  document.querySelector('[data-action="toggle-admin"]')?.addEventListener('click', () => {
    state.adminMessage = '';
    if (state.adminAuth.registered) {
      state.showAdminAuth = true;
      state.showAdminDrawer = false;
    } else {
      state.showAdminAuth = true;
      state.showAdminDrawer = false;
      state.adminForm = {
        name: state.adminForm.name,
        password: DEFAULT_ADMIN_PASSWORD,
        confirmPassword: DEFAULT_ADMIN_PASSWORD
      };
    }
    render();
  });

  document.querySelector('[data-action="toggle-sql"]')?.addEventListener('click', () => {
    state.showSqlExport = !state.showSqlExport;
    state.showAdminDrawer = true;
    render();
  });

  document.querySelector('[data-action="close-admin"]')?.addEventListener('click', () => {
    state.showAdminDrawer = false;
    render();
  });

  document.querySelector('[data-action="close-auth"]')?.addEventListener('click', () => {
    state.showAdminAuth = false;
    state.adminMessage = '';
    render();
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

  document.querySelector('#login-form')?.addEventListener('input', (event) => {
    const form = new FormData(event.currentTarget);
    state.visitor = {
      ...state.visitor,
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim()
    };
  });

  document.querySelector('#availability-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.id === state.selectedVehicle);
    state.activeVideo = vehicleIndex >= 0 ? vehicleIndex : 0;
    state.availabilityChecked = true;
    state.selectedLead = null;
    render();
  });

  document.querySelector('#details-form')?.addEventListener('input', (event) => {
    const form = new FormData(event.currentTarget);
    state.detailsDraft = {
      pickup: String(form.get('pickup') || ''),
      drop: String(form.get('drop') || ''),
      notes: String(form.get('notes') || '')
    };
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
    state.detailsDraft = {
      pickup: '',
      drop: '',
      notes: ''
    };
    persistState();
    render();
  });

  document.querySelector('#admin-register-form')?.addEventListener('input', (event) => {
    const form = new FormData(event.currentTarget);
    state.adminForm = {
      name: String(form.get('name') || ''),
      password: String(form.get('password') || ''),
      confirmPassword: String(form.get('confirmPassword') || '')
    };
  });

  document.querySelector('#admin-register-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');

    if (!name) {
      state.adminMessage = 'Enter an admin name.';
      render();
      return;
    }

    if (password !== confirmPassword) {
      state.adminMessage = 'Passwords do not match.';
      render();
      return;
    }

    state.adminAuth = {
      ...state.adminAuth,
      registered: true,
      name,
      password
    };
    state.adminLoginPassword = '';
    state.adminMessage = 'Admin registered. You can now log in and add Face ID.';
    persistState();
    render();
  });

  document.querySelector('#admin-login-form')?.addEventListener('input', (event) => {
    const form = new FormData(event.currentTarget);
    state.adminLoginPassword = String(form.get('password') || '');
  });

  document.querySelector('#admin-login-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');

    if (password !== state.adminAuth.password) {
      state.adminMessage = 'Incorrect admin password.';
      render();
      return;
    }

    state.showAdminAuth = false;
    state.showAdminDrawer = true;
    state.adminMessage = '';
    state.adminLoginPassword = '';
    render();
  });

  document.querySelector('[data-action="faceid-register"]')?.addEventListener('click', async () => {
    try {
      await registerFaceId();
      state.adminMessage = 'Face ID added for this device.';
      render();
    } catch (error) {
      state.adminMessage = error instanceof Error ? error.message : 'Face ID setup failed.';
      render();
    }
  });

  document.querySelector('[data-action="faceid-login"]')?.addEventListener('click', async () => {
    try {
      await loginWithFaceId();
    } catch (error) {
      state.adminMessage = error instanceof Error ? error.message : 'Face ID login failed.';
      render();
    }
  });
}

persistState();
render();
