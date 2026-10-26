requireLogin('STAFF', 'ADMIN');

const resultBox = document.getElementById('result');
const recent = document.getElementById('recent');
let okCount = 0, noCount = 0, busy = false, camera = null;
const rows = [];

// send the scanned text to the server and show green or red
async function check(text) {
    if (busy) return;           // ignore the camera seeing the same code again and again
    busy = true;
    let res;
    try {
        res = await api('/scan', { method: 'POST', body: { token: text.trim() } });
    } catch (err) {
        res = { ok: false, message: err.message };
    }
    show(res);
    setTimeout(() => (busy = false), 2000);     // short pause before the next scan
}

function show(res) {
    resultBox.className = 'result ' + (res.ok ? 'ok' : 'no');
    resultBox.innerHTML = `${res.ok ? 'SERVE' : 'DO NOT SERVE'}: ${esc(res.message)}
        <small>${res.student ? esc(res.student) : ''}${res.regNo ? ' (' + esc(res.regNo) + ')' : ''}</small>`;

    res.ok ? okCount++ : noCount++;
    document.getElementById('count-ok').textContent = okCount + ' served';
    document.getElementById('count-no').textContent = noCount + ' rejected';

    rows.unshift(`<tr><td>${fmtTime(new Date())}</td><td>${res.student ? esc(res.student) : '-'}</td>
        <td><span class="badge ${res.ok ? 'ACCEPTED' : 'REJECTED'}">${res.ok ? 'Served' : 'Rejected'}</span> ${res.ok ? '' : esc(res.message)}</td></tr>`);
    recent.innerHTML = rows.slice(0, 10).join('');
}

// ---- typed / pasted code ----
document.getElementById('manual-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('manual');
    if (input.value.trim()) check(input.value);
    input.value = '';
});

// ---- camera ----
const startBtn = document.getElementById('start-cam');
const stopBtn = document.getElementById('stop-cam');

startBtn.addEventListener('click', async () => {
    try {
        camera = new Html5Qrcode('reader');
        await camera.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => check(text), () => {});
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (err) {
        document.getElementById('cam-note').textContent = 'Could not start the camera (it needs https or localhost, and permission). Use the paste box instead.';
    }
});

stopBtn.addEventListener('click', async () => {
    if (camera) { await camera.stop(); camera.clear(); }
    startBtn.disabled = false;
    stopBtn.disabled = true;
});
