// Meal cards shared by the student dashboard and the schedule page.
// The server decides what is allowed. This file only shows the state and sends the click.

const PHASE_TEXT = {
    OPEN: 'Open for changes',
    LOCKED: 'Locked',
    SERVING: 'Serving now',
    CLOSED: 'Closed',
};

// one meal -> HTML
function mealCardHTML(m) {
    let clock;
    if (m.phase === 'OPEN') {
        clock = `Cut-off in <span class="countdown" data-deadline="${m._deadline}">${fmtCountdown(m.seconds_to_cutoff)}</span>`;
    } else if (m.phase === 'LOCKED') {
        clock = `Locked. Serving starts at ${fmtTime(m.starts_at)}`;
    } else if (m.phase === 'SERVING') {
        clock = m.ends_at ? `Serving until ${fmtTime(m.ends_at)}` : 'Serving now';
    } else {
        clock = 'This meal is over';
    }

    const canChange = m.phase === 'OPEN';
    const button = canChange
        ? `<button class="btn ${m.opted_in ? 'light' : ''}" data-slot="${m.id}" data-next="${!m.opted_in}">${m.opted_in ? 'Opt out' : 'Opt in'}</button>`
        : (m.phase === 'SERVING' && m.opted_in
            ? `<a class="btn" href="student-qr.html?slot=${m.id}">Show QR</a>`
            : `<button class="btn" disabled>Locked</button>`);

    return `
        <div class="card meal">
            <div class="row"><h2>${esc(m.meal.toLowerCase())}</h2><span class="badge ${m.phase}">${PHASE_TEXT[m.phase]}</span></div>
            <div class="muted">Starts ${fmtTime(m.starts_at)}</div>
            <div class="menu">${m.menu ? esc(m.menu) : '<span class="muted">Menu not added yet</span>'}</div>
            <div class="clock">${clock}</div>
            <div class="choice">
                <span class="state ${m.opted_in ? 'in' : 'out'}">${m.opted_in ? 'You are opted in' : 'You are opted out'}</span>
                ${button}
            </div>
        </div>`;
}

// draws all cards into a container and wires the opt in/out buttons
function renderMeals(container, meals, reload) {
    if (!meals.length) {
        container.innerHTML = '<div class="card empty">No meals have been added for this day yet.</div>';
        return;
    }
    const now = Date.now();
    meals.forEach((m) => { m._deadline = now + m.seconds_to_cutoff * 1000; });
    container.innerHTML = meals.map(mealCardHTML).join('');

    container.querySelectorAll('button[data-slot]').forEach((b) => {
        b.addEventListener('click', async () => {
            b.disabled = true;
            try {
                const res = await api(`/meals/${b.dataset.slot}/optin`, {
                    method: 'POST',
                    body: { optedIn: b.dataset.next === 'true' },
                });
                toast(res.optedIn ? 'You are opted in' : 'You are opted out');
            } catch (err) {
                toast(err.message, 'error');   // e.g. "This meal is locked. The cut-off time has passed."
            }
            reload();                           // always re-read the truth from the server
        });
    });
}

// ticks the countdowns every second; when one reaches zero it reloads so the card locks itself
let tickerStarted = false;
function startTicker(reload) {
    if (tickerStarted) return;
    tickerStarted = true;
    setInterval(() => {
        let reachedZero = false;
        document.querySelectorAll('.countdown').forEach((el) => {
            const left = (Number(el.dataset.deadline) - Date.now()) / 1000;
            el.textContent = fmtCountdown(left);
            if (left <= 0) reachedZero = true;
        });
        if (reachedZero) setTimeout(reload, 1200);   // small wait so the server clock has passed the cut-off too
    }, 1000);
}
