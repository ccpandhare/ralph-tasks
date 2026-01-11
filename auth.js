// Hardcoded SHA-256 hash of the password
// For demo purposes, the password is "admin123"
// Hash generated using: echo -n "admin123" | sha256sum
const PASSWORD_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

// Check if user is already authenticated
function isAuthenticated() {
    return sessionStorage.getItem('authenticated') === 'true';
}

// Set authentication state
function setAuthenticated(value) {
    sessionStorage.setItem('authenticated', value ? 'true' : 'false');
}

// SHA-256 hash function
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Logout function
function logout() {
    setAuthenticated(false);
    window.location.href = 'login.html';
}

// Handle login form submission
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');

        // Hash the entered password
        const hashedPassword = await sha256(password);

        // Verify password
        if (hashedPassword === PASSWORD_HASH) {
            setAuthenticated(true);
            window.location.href = 'index.html';
        } else {
            errorMessage.textContent = 'Incorrect password. Please try again.';
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    });
}

// Get authentication token for API requests
function getAuthToken() {
    if (!isAuthenticated()) return null;
    return PASSWORD_HASH;
}

// Redirect to login if not authenticated (for protected pages)
if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}
