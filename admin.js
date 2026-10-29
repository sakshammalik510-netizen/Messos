/* =====================================================================
   admin.js  -  shared code used by every admin page.

   IMPORTANT IDEA: all reading/saving of data happens in the "DB" part
   below. Right now it uses the browser's localStorage (works with no
   backend, good for a demo). Later, if your team builds the real
   Express + PostgreSQL server, you only change THIS part to use fetch().
   The pages themselves stay the same.
   ===================================================================== */

// ---------- 1. Tiny database helper (localStorage) ----------
const DB = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Keys (names of the "boxes" where we store each kind of data)
const KEYS = {
  users: "messos_users",
  slots: "messos_slots",
  optins: "messos_optins",
  ledger: "messos_ledger",
  session: "messos_admin_session"
};

const EMAIL_DOMAIN = "@mnnit.ac.in";

function isCollegeEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith(EMAIL_DOMAIN);
}

// ---------- 2. Helpers ----------
function todayStr() {
  // gives "2026-10-24" style text using the computer's local date
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Stops someone typing <script> into a name box and breaking the page
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function fmtTime(hhmm) {
  // "14:41" -> "02:41 pm"
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return String(h12).padStart(2, "0") + ":" + String(m).padStart(2, "0") + " " + ampm;
}

// Turns a slot's date + time text into a real Date object we can compare
function slotDate(slot, timeField) {
  return new Date(slot.date + "T" + slot[timeField]);
}

// Open -> before cut-off | Locked -> after cut-off, before meal ends | Closed -> meal over
function slotStatus(slot) {
  const now = new Date();
  const cutoff = slotDate(slot, "cutoffTime");
  const end = new Date(slotDate(slot, "startTime").getTime() + 2 * 60 * 60 * 1000); // meal lasts 2 hours
  if (now < cutoff) return "open";
  if (now < end) return "locked";
  return "closed";
}

// Head-count for ONE meal slot, so every page shows the same numbers.
//   optedIn   = students who are registered right now and opted in (forecast)
//   served    = different students served (each student counted once)
//   remaining = opted in but not served yet
function headCount(slot) {
  const studentIds = new Set(DB.get(KEYS.users, []).filter(u => u.role === "student").map(u => u.id));
  const optedInIds = new Set(
    DB.get(KEYS.optins, [])
      .filter(o => o.slotId === slot.id && o.optedIn && studentIds.has(o.userId))
      .map(o => o.userId)
  );
  const servedIds = new Set(
    DB.get(KEYS.ledger, [])
      .filter(l => l.slotId === slot.id && l.result === "accepted")
      .map(l => l.userId)
  );
  const servedOptedIn = [...servedIds].filter(id => optedInIds.has(id)).length;
  return {
    optedIn: optedInIds.size,
    served: servedIds.size,
    remaining: Math.max(0, optedInIds.size - servedOptedIn)
  };
}

// ---------- 3. Demo data (only created the first time) ----------
function seedIfEmpty() {
  if (DB.get(KEYS.users, null)) return; // data already exists, do nothing

  const users = [
    { id: "u1", name: "Aarav",  email: "aarav@mnnit.ac.in",  regNo: "20265001", role: "student" },
    { id: "u2", name: "Diya",   email: "diya@mnnit.ac.in",   regNo: "20265002", role: "student" },
    { id: "u3", name: "Rohan",  email: "rohan@mnnit.ac.in",  regNo: "20265003", role: "student" },
    { id: "u4", name: "Meera",  email: "meera@mnnit.ac.in",  regNo: "20265004", role: "student" },
    { id: "u5", name: "Kabir",  email: "kabir@mnnit.ac.in",  regNo: "20265005", role: "student" },
    { id: "s1", name: "Ramesh (kitchen)", email: "ramesh@mnnit.ac.in", regNo: "-", role: "staff" },
    { id: "a1", name: "Admin",  email: "admin@mnnit.ac.in",  regNo: "-", role: "admin" }
  ];

  const t = todayStr();
  const slots = [
    { id: "m1", date: t, mealType: "Breakfast", items: "Poha, tea",     startTime: "08:00", cutoffTime: "06:00" },
    { id: "m2", date: t, mealType: "Lunch",     items: "Dal, rice, roti", startTime: "13:00", cutoffTime: "11:00" },
    { id: "m3", date: t, mealType: "Dinner",    items: "Paneer, roti",   startTime: "19:41", cutoffTime: "17:41" }
  ];

  // every student opted in for everything except Kabir skipping breakfast
  const optins = [];
  users.filter(u => u.role === "student").forEach(u => {
    slots.forEach(s => {
      optins.push({ userId: u.id, slotId: s.id, optedIn: !(u.id === "u5" && s.id === "m1") });
    });
  });

  DB.set(KEYS.users, users);
  DB.set(KEYS.slots, slots);
  DB.set(KEYS.optins, optins);
  DB.set(KEYS.ledger, []);
}

function migrateUsers() {
  const users = DB.get(KEYS.users, []);
  let changed = false;

  users.forEach(user => {
    if (typeof user.email === "string" && /@college\.edu$/i.test(user.email)) {
      user.email = user.email.replace(/@college\.edu$/i, EMAIL_DOMAIN);
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(user, "diet")) {
      delete user.diet;
      changed = true;
    }
  });

  if (changed) DB.set(KEYS.users, users);
}

// ---------- 4. Login guard ----------
function requireAdmin() {
  const session = DB.get(KEYS.session, null);
  const user = session && DB.get(KEYS.users, []).find(account => account.id === session.id);
  if (!user || !["admin", "staff"].includes(user.role)) {
    localStorage.removeItem(KEYS.session);
    location.replace("studentlogin.html");
    return null;
  }

  session.name = user.name;
  session.role = user.role;
  DB.set(KEYS.session, session);
  return session;
}

// ---------- 5. Draw the green top bar on every page ----------
function renderNav(activePage) {
  const session = requireAdmin();
  if (!session) return;

  const links = [
    ["admin-dashboard.html", "Dashboard", "dashboard"],
    ["admin-menu.html",      "Menu & cut-off", "menu"],
    ["admin-users.html",     "Users", "users"],
    ["admin-audit.html",     "Audit trail", "audit"]
  ];
  const linkHtml = links
    .map(l => `<a href="${l[0]}" class="${l[2] === activePage ? "active" : ""}">${l[1]}</a>`)
    .join("");

  document.getElementById("topbar").innerHTML = `
    <div class="topbar">
      <span class="brand">MessOS</span>
      <nav>${linkHtml}</nav>
      <span class="who">${esc(session.name)} (${esc(session.role)})</span>
      <button class="btn-logout" id="logoutBtn">Log out</button>
    </div>`;

  document.getElementById("logoutBtn").onclick = function () {
    localStorage.removeItem(KEYS.session);
    location.href = "studentlogin.html";
  };
}

seedIfEmpty();
migrateUsers();
