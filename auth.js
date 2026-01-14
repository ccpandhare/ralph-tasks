// Password hash - updated regularly for security
// The actual password is stored securely in the server's .env file
const PASSWORD_HASH = "0fc9d5faa3ab9b9e53f94f3070c29854a0d7982ab4de27f8530c96c596a315d4";

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
