// Password hashes - updated regularly for security
// The actual passwords are stored securely in the server's .env file
const PASSWORD_HASH = "0fc9d5faa3ab9b9e53f94f3070c29854a0d7982ab4de27f8530c96c596a315d4";
const TEST_PASSWORD_HASH = "709dd3e8bf11b4a56227095a635ddf42a3da473f8db0441f7c01e24c671dd60d"; // Test account for E2E tests

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

        // Verify password (check both production and test accounts)
        if (hashedPassword === PASSWORD_HASH || hashedPassword === TEST_PASSWORD_HASH) {
            setAuthenticated(true);
            // Store which account type for API calls
            sessionStorage.setItem('authToken', hashedPassword);
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
    // Return the actual token that was used to login (stored in sessionStorage)
    return sessionStorage.getItem('authToken') || PASSWORD_HASH;
}

// Redirect to login if not authenticated (for protected pages)
if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}
