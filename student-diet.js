requireLogin('STUDENT');
const form = document.getElementById('diet-form');
const tbody = document.getElementById('history');

async function load() {
    try {
        const rows = await api('/diet/history');      // newest first
        const dash = '<span class="muted">none</span>';

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty">No entries yet. Add your first one above.</td></tr>';
            return;
        }
        // the newest row is the one the kitchen sees
        document.getElementById('current-card').style.display = 'block';
        document.getElementById('current').innerHTML =
            `<p><b>Preference:</b> ${rows[0].preference ? esc(rows[0].preference) : dash}</p>
             <p><b>Allergies:</b> ${rows[0].allergies ? esc(rows[0].allergies) : dash}</p>
             <p class="muted">Saved ${fmtDateTime(rows[0].created_at)}</p>`;

        tbody.innerHTML = rows.map((r) => `<tr>
            <td>${fmtDateTime(r.created_at)}</td>
            <td>${r.preference ? esc(r.preference) : dash}</td>
            <td>${r.allergies ? esc(r.allergies) : dash}</td></tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty">${esc(err.message)}</td></tr>`;
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const preference = document.getElementById('preference').value.trim();
    const allergies = document.getElementById('allergies').value.trim();
    if (!preference && !allergies) return toast('Write a preference or an allergy first', 'error');
    try {
        await api('/diet', { method: 'POST', body: { preference, allergies } });
        toast('Saved');
        form.reset();
        load();
    } catch (err) {
        toast(err.message, 'error');
    }
});

load();
