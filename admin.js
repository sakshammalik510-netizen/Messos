const user = requireLogin('ADMIN', 'STAFF');
const isAdmin = user.role === 'ADMIN';
const dayInput = document.getElementById('day');
const slotSelect = document.getElementById('slot');
dayInput.value = todayIST();

// kitchen staff only see Forecast and Diet notes
if (!isAdmin) {
    document.getElementById('title').textContent = 'Kitchen view';
    document.querySelectorAll('[data-admin]').forEach((b) => b.remove());
}

let slots = [];
let currentTab = 'forecast';
const none = (text) => `<span class="muted">${text}</span>`;
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`;

// ---------- tabs ----------
document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    currentTab = b.dataset.tab;
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + currentTab));
    loadTab();
});

// ---------- forecast (always loaded, it also fills the meal dropdown) ----------
async function loadForecast() {
    const box = document.getElementById('forecast');
    try {
        slots = await api('/admin/forecast?date=' + dayInput.value);
    } catch (err) {
        box.innerHTML = `<div class="card empty">${esc(err.message)}</div>`;
        return;
    }
    const previous = slotSelect.value;
    slotSelect.innerHTML = slots.length
        ? slots.map((s) => `<option value="${s.id}">${esc(s.meal.toLowerCase())}</option>`).join('')
        : '<option value="">no meals on this day</option>';
    if (slots.some((s) => String(s.id) === previous)) slotSelect.value = previous;

    if (!slots.length) { box.innerHTML = '<div class="card empty">No meals on this day.</div>'; return; }

    box.innerHTML = '<div class="grid">' + slots.map((s) => {
        const max = Math.max(s.projected, s.served, 1);
        const surplus = s.phase === 'CLOSED' ? s.projected - s.served : 0;
        return `<div class="card">
            <div class="row"><h2 style="text-transform:capitalize">${esc(s.meal.toLowerCase())}</h2><span class="badge ${s.phase}">${s.phase}</span></div>
            <div class="muted">${s.menu ? esc(s.menu) : 'No menu added'}</div>
            <div class="stat"><div class="big">${s.projected}</div><div class="label">expected (opted in)${s.locked_headcount != null ? ' - final head-count locked: ' + s.locked_headcount : ''}</div></div>
            <div class="muted">Expected</div><div class="bar"><i class="proj" style="width:${(s.projected / max) * 100}%"></i></div>
            <div class="muted">Served so far: <b>${s.served}</b></div><div class="bar"><i class="served" style="width:${(s.served / max) * 100}%"></i></div>
            ${surplus > 0 ? `<div class="alert"><b>${surplus} surplus plate(s).</b> Food was prepared for people who did not come. Consider redistributing it.</div>` : ''}
        </div>`;
    }).join('') + '</div>';
}

// ---------- other tabs ----------
async function loadTab() {
    if (currentTab === 'forecast') return loadForecast();
    if (currentTab === 'users') return loadUsers();
    if (currentTab === 'create') return;
    if (!slotSelect.value) return;
    const id = slotSelect.value;
    try {
        if (currentTab === 'notes') {
            const rows = await api('/admin/diet-notes?slotId=' + id);
            document.getElementById('notes').innerHTML = rows.length
                ? rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.reg_no)}</td><td>${r.preference ? esc(r.preference) : none('-')}</td><td>${r.allergies ? esc(r.allergies) : none('-')}</td></tr>`).join('')
                : emptyRow(4, 'No notes or allergies for this meal.');
        }
        if (currentTab === 'ledger') {
            const rows = await api('/admin/ledger?slotId=' + id);
            document.getElementById('ledger').innerHTML = rows.length
                ? rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.reg_no)}</td><td>${esc(r.staff)}</td><td>${fmtDateTime(r.scanned_at)}</td></tr>`).join('')
                : emptyRow(4, 'Nobody has been served yet.');
        }
        if (currentTab === 'audit') {
            const rows = await api('/admin/audit?slotId=' + id);
            document.getElementById('audit').innerHTML = rows.length
                ? rows.map((r) => `<tr><td>${fmtDateTime(r.scanned_at)}</td><td>${r.student ? esc(r.student) : none('unknown')}</td>
                    <td><span class="badge ${r.result}">${r.result}</span></td><td>${r.reason ? esc(r.reason) : ''}</td></tr>`).join('')
                : emptyRow(4, 'No scans yet.');
        }
    } catch (err) { toast(err.message, 'error'); }
}

async function loadUsers() {
    try {
        const rows = await api('/admin/users');
        document.getElementById('users').innerHTML = rows.map((u) =>
            `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.reg_no)}</td><td>${u.role}</td><td>${u.email_verified ? 'Yes' : 'No'}</td></tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

// ---------- add a meal (admin) ----------
const slotForm = document.getElementById('slot-form');
if (slotForm) {
    document.getElementById('f-date').value = todayIST();
    slotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('f-date').value;
        const at = (id) => `${date}T${document.getElementById(id).value}:00+05:30`;   // build a full timestamp with the India offset
        const cutoff = document.getElementById('f-cutoff').value;
        const start = document.getElementById('f-start').value;
        const end = document.getElementById('f-end').value;
        if (!(cutoff < start && start < end)) return toast('Order must be: cut-off, then start, then end', 'error');
        try {
            await api('/admin/slots', {
                method: 'POST',
                body: {
                    date,
                    meal: document.getElementById('f-meal').value,
                    menu: document.getElementById('f-menu').value.trim() || undefined,
                    cutoffAt: at('f-cutoff'), startsAt: at('f-start'), endsAt: at('f-end'),
                },
            });
            toast('Meal created');
            slotForm.reset();
            document.getElementById('f-date').value = date;
            dayInput.value = date;
            loadForecast();
        } catch (err) { toast(err.message, 'error'); }   // e.g. a duplicate meal on that date
    });
}

dayInput.addEventListener('change', async () => { await loadForecast(); loadTab(); });
slotSelect.addEventListener('change', loadTab);
loadForecast();
setInterval(() => { if (currentTab === 'forecast') loadForecast(); }, 30000);   // keep the live numbers fresh
