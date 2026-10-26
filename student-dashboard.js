const user = requireLogin('STUDENT');
const list = document.getElementById('meals');
const summary = document.getElementById('summary');
document.getElementById('hello').textContent = 'Hello, ' + user.name;

async function load() {
    try {
        const meals = await api('/meals');
        renderMeals(list, meals, load);
        showSummary(meals);
    } catch (err) {
        list.innerHTML = `<div class="card empty">${esc(err.message)}</div>`;
    }
}

function showSummary(meals) {
    const optedIn = meals.filter((m) => m.opted_in).length;
    const nextOpen = meals.find((m) => m.phase === 'OPEN');
    const serving = meals.find((m) => m.phase === 'SERVING' && m.opted_in);

    summary.innerHTML = `
        <div class="card stat"><div class="big">${optedIn} / ${meals.length}</div><div class="label">meals you are opted in for today</div></div>
        <div class="card stat">
            <div class="big">${nextOpen ? `<span class="countdown" data-deadline="${nextOpen._deadline}">${fmtCountdown(nextOpen.seconds_to_cutoff)}</span>` : '--'}</div>
            <div class="label">${nextOpen ? 'until the ' + esc(nextOpen.meal.toLowerCase()) + ' cut-off' : 'no meal is open for changes'}</div>
        </div>
        <div class="card stat">
            ${serving
                ? `<div class="big" style="font-size:20px">${esc(serving.meal.toLowerCase())} is being served</div><a class="btn" href="student-qr.html?slot=${serving.id}">Show my QR</a>`
                : '<div class="big" style="font-size:20px">No QR needed now</div><div class="label">it appears when your meal is being served</div>'}
        </div>`;
}

load();
startTicker(load);
