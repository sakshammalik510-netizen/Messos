const user = requireLogin('STUDENT');
const info = document.getElementById('info');
const box = document.getElementById('qrcode');
const bar = document.getElementById('bar');
const timerText = document.getElementById('timer');

let slotId = new URLSearchParams(location.search).get('slot');
let deadline = 0;       // when the current QR stops being fresh
let busy = false;

function stop(message) {
    box.innerHTML = '';
    bar.style.width = '0%';
    timerText.textContent = '';
    info.textContent = message;
    clearInterval(ticking);
}

// ask the server for a fresh signed token and draw it
async function refresh() {
    if (busy) return;
    busy = true;
    try {
        const data = await api('/qr/' + slotId);       // { token, expiresIn }
        box.innerHTML = '';
        new QRCode(box, { text: data.token, width: 220, height: 220 });
        deadline = Date.now() + data.expiresIn * 1000;
    } catch (err) {
        stop(err.message);                              // e.g. "QR is only available while the meal is served"
    }
    busy = false;
}

// every second: move the bar, and fetch a new code when time is up
const ticking = setInterval(() => {
    if (!deadline) return;
    const left = (deadline - Date.now()) / 1000;
    bar.style.width = Math.max(0, (left / 30) * 100) + '%';
    timerText.textContent = left > 0 ? `New code in ${Math.ceil(left)}s` : 'Refreshing...';
    if (left <= 0) refresh();
}, 1000);

(async function start() {
    try {
        if (!slotId) {   // opened from the menu, so find the meal being served now
            const meals = await api('/meals');
            const m = meals.find((x) => x.phase === 'SERVING' && x.opted_in);
            if (!m) return stop('No meal is being served for you right now. Your QR appears when a meal you opted into starts.');
            slotId = m.id;
        }
        info.textContent = user.name;
        refresh();
    } catch (err) {
        stop(err.message);
    }
})();
