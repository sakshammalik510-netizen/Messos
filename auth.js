// Logic for studentlogin.html and studentregister.html

const msg = document.getElementById('msg');
const btn = document.getElementById('submit-btn');

function show(text, kind) {
    msg.textContent = text;
    msg.className = 'msg ' + kind;
}

// Already logged in? Skip the login page.
if (Session.token() && Session.user()) {
    location.href = HOME[Session.user().role];
}

// ---------- LOGIN ----------
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();                       // stop the browser's default page reload
        btn.disabled = true;
        show('Logging in...', '');
        try {
            const data = await api('/auth/login', {
                method: 'POST',
                body: {
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value,
                },
            });
            Session.save(data.token, data.user);
            location.href = HOME[data.user.role];  // student / staff / admin each get their own page
        } catch (err) {
            show(err.message, 'error');
            btn.disabled = false;
        }
    });
}

// ---------- REGISTER ----------
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const get = (id) => document.getElementById(id).value;
        const email = get('email').trim().toLowerCase();

        // checks we can do before bothering the server
        if (!email.endsWith('@' + COLLEGE_DOMAIN)) return show(`Please use your college e-mail (@${COLLEGE_DOMAIN})`, 'error');
        if (get('password').length < 8) return show('Password must be at least 8 characters', 'error');
        if (get('password') !== get('confirm')) return show('The two passwords do not match', 'error');

        btn.disabled = true;
        show('Creating your account...', '');
        try {
            const data = await api('/auth/register', {
                method: 'POST',
                body: {
                    name: get('name').trim(),
                    regNo: get('regNo').trim(),
                    email,
                    password: get('password'),
                },
            });
            show(data.message + ' Taking you to login...', 'ok');
            setTimeout(() => (location.href = 'studentlogin.html'), 2500);
        } catch (err) {
            show(err.message, 'error');
            btn.disabled = false;
        }
    });
}
