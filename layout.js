// Builds the top navigation bar. Each page just needs <header class="topbar" id="topbar"></header>

const NAV = {
    STUDENT: [
        ['student-dashboard.html', 'Dashboard', 'bx-home'],
        ['student-schedule.html', 'Schedule', 'bx-calendar'],
        ['student-qr.html', 'My QR', 'bx-qr'],
        ['student-diet.html', 'Diet log', 'bx-leaf'],
    ],
    STAFF: [
        ['staff-scan.html', 'Scan', 'bx-scan'],
        ['admin-dashboard.html', 'Kitchen view', 'bx-bowl-hot'],
    ],
    ADMIN: [
        ['admin-dashboard.html', 'Admin', 'bx-grid-alt'],
        ['staff-scan.html', 'Scan', 'bx-scan'],
    ],
};

function buildNav() {
    const user = Session.user();
    const bar = document.getElementById('topbar');
    if (!user || !bar) return;
    const here = location.pathname.split('/').pop();

    const links = NAV[user.role]
        .map(([href, label, icon]) =>
            `<a href="${href}" class="${href === here ? 'active' : ''}"><i class='bx ${icon}'></i> ${label}</a>`)
        .join('');

    bar.innerHTML = `
        <a class="brand" href="${HOME[user.role]}"><img src="logo.png" alt=""> MessOS</a>
        <nav>${links}</nav>
        <div class="who"><span>${esc(user.name)} (${user.role.toLowerCase()})</span><button id="logout-btn">Log out</button></div>`;

    document.getElementById('logout-btn').addEventListener('click', () => {
        Session.clear();
        location.href = 'studentlogin.html';
    });
}
buildNav();
