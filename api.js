// Shared helpers used by every page. Load this file first.

// Where the backend runs. Change this one line when you deploy.
const API_URL = 'http://localhost:5000/api';

// Must match EMAIL_DOMAIN in the backend .env (used only for a friendly hint on the register page)
const COLLEGE_DOMAIN = 'college.edu.in';

// Where each role lands after login
const HOME = {
    STUDENT: 'student-dashboard.html',
    STAFF: 'staff-scan.html',
    ADMIN: 'admin-dashboard.html',
};

// ---- remember who is logged in (kept in the browser's localStorage) ----
const Session = {
    save(token, user) {
        localStorage.setItem('messos_token', token);
        localStorage.setItem('messos_user', JSON.stringify(user));
    },
    token() { return localStorage.getItem('messos_token'); },
    user() {
        try { return JSON.parse(localStorage.getItem('messos_user')); } catch { return null; }
    },
    clear() {
        localStorage.removeItem('messos_token');
        localStorage.removeItem('messos_user');
    },
};

// ---- talk to the backend. Usage:  const meals = await api('/meals');
//      await api('/diet', { method: 'POST', body: { preference: 'no onion' } })
async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (Session.token()) headers.Authorization = 'Bearer ' + Session.token();

    let res;
    try {
        res = await fetch(API_URL + path, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
    } catch {
        throw new Error('Cannot reach the server. Is the backend running?');
    }

    let data = null;
    try { data = await res.json(); } catch { /* no JSON body */ }

    // logged-in user whose token expired: send them back to login
    if (res.status === 401 && Session.token()) {
        Session.clear();
        location.href = 'studentlogin.html';
        throw new Error('Your session expired. Please log in again.');
    }
    if (!res.ok) throw new Error((data && data.error) || 'Something went wrong');
    return data;
}

// ---- call at the top of every protected page. Sends strangers to login, wrong roles to their own home.
function requireLogin(...roles) {
    const user = Session.user();
    if (!Session.token() || !user) { location.href = 'studentlogin.html'; return null; }
    if (roles.length && !roles.includes(user.role)) { location.href = HOME[user.role]; return null; }
    return user;
}

// ---- small helpers ----
// esc() makes text safe to put inside innerHTML (stops someone typing <script> in their allergy note)
function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const IST = 'Asia/Kolkata';
function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: IST });
}
function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST });
}
// 3725 -> "01:02:05"
function fmtCountdown(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
// today's date as YYYY-MM-DD in Indian time
function todayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: IST });
}

function toast(message, type = 'ok') {
    let box = document.getElementById('toast');
    if (!box) { box = document.createElement('div'); box.id = 'toast'; document.body.appendChild(box); }
    const item = document.createElement('div');
    item.className = 'toast-item ' + type;
    item.textContent = message;
    box.appendChild(item);
    setTimeout(() => item.remove(), 3500);
}
