requireLogin('STUDENT');
const day = document.getElementById('day');
const list = document.getElementById('meals');
day.value = todayIST();

async function load() {
    try {
        const meals = await api('/meals?date=' + day.value);
        renderMeals(list, meals, load);
    } catch (err) {
        list.innerHTML = `<div class="card empty">${esc(err.message)}</div>`;
    }
}

// move the date by +1 or -1 day
function shift(days) {
    const d = new Date(day.value + 'T00:00:00');
    d.setDate(d.getDate() + days);
    day.value = d.toLocaleDateString('en-CA');
    load();
}

day.addEventListener('change', load);
document.getElementById('prev').addEventListener('click', () => shift(-1));
document.getElementById('next').addEventListener('click', () => shift(1));
load();
startTicker(load);
