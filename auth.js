// Central Auth Configuration
const CENTRAL_AUTH_URL = 'https://auth.chinmaypandhare.uk';
const SERVICE_NAME = 'tasks';
const CURRENT_URL = window.location.origin;

// Legacy test password hash for E2E tests only
const TEST_PASSWORD_HASH = "709dd3e8bf11b4a56227095a635ddf42a3da473f8db0441f7c01e24c671dd60d";

// Check if user is authenticated with the backend (which verifies with central auth)
async function checkAuthentication() {
    try {
        // Build headers (includes Bearer token for test account)
        const headers = {};
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/tasks', {
            method: 'GET',
            headers: headers,
            credentials: 'include'
        });
        return response.ok;
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
}

// Redirect to central auth for login
function redirectToLogin() {
    const redirectUrl = encodeURIComponent(CURRENT_URL + '/');
    window.location.href = `${CENTRAL_AUTH_URL}/?redirect=${redirectUrl}&service=${SERVICE_NAME}`;
}

// Logout - call central auth logout endpoint then redirect
async function logout() {
    // Clear any local session state
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('authToken');

    try {
        // Call the central auth logout endpoint (clears the cookie)
        await fetch(`${CENTRAL_AUTH_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    // Redirect to login page
    window.location.href = 'login.html';
}

// Get authentication token for API requests (for E2E tests using Bearer token)
function getAuthToken() {
    // Return test token if stored (for E2E tests)
    const testToken = sessionStorage.getItem('authToken');
    if (testToken === TEST_PASSWORD_HASH) {
        return testToken;
    }
    // For central auth, cookies are used automatically
    return null;
}

// SHA-256 hash function (kept for E2E test compatibility)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Check if test account is being used (for E2E tests)
function isTestAccountSession() {
    return sessionStorage.getItem('authToken') === TEST_PASSWORD_HASH;
}

// Handle authentication on page load
async function handleAuth() {
    const isLoginPage = window.location.pathname.includes('login.html');

    if (isLoginPage) {
        // On login page, check if already authenticated to redirect away
        const isAuthenticated = await checkAuthentication();
        if (isAuthenticated) {
            window.location.href = 'index.html';
        }
        // Otherwise show the login page (no redirect)
    } else {
        // On protected pages, verify authentication
        const isAuthenticated = await checkAuthentication();
        if (!isAuthenticated) {
            // For test accounts, redirect to local login
            // For regular users, redirect to central auth
            if (isTestAccountSession()) {
                // Test account token exists but API failed - redirect to local login
                window.location.href = 'login.html';
            } else {
                redirectToLogin();
            }
        }
    }
}

// Handle login form submission (for E2E tests only)
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');

        // Hash the entered password
        const hashedPassword = await sha256(password);

        // Check if it's the test account (for E2E tests only)
        if (hashedPassword === TEST_PASSWORD_HASH) {
            // Store the test token for API calls
            sessionStorage.setItem('authenticated', 'true');
            sessionStorage.setItem('authToken', hashedPassword);
            window.location.href = 'index.html';
        } else {
            // For regular users, redirect to central auth
            errorMessage.textContent = 'Please use the "Login with Central Auth" button to login.';
            document.getElementById('password').value = '';
        }
    });
}

// Initialize authentication on page load
handleAuth();
