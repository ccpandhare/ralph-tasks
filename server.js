const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Hardcoded password hash for authentication (same as in auth.js)
const PASSWORD_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

// Port configuration
const PORT = process.env.PORT || 3001;

// Path to tasks.json and projects.json
const TASKS_FILE = '/var/main/tasks.json';
const PROJECTS_FILE = '/var/main/projects.json';

// Helper function to check authentication
function isAuthenticated(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return false;

    // Expect format: "Bearer <password_hash>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return false;

    return parts[1] === PASSWORD_HASH;
}

// Helper function to send JSON response
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

// Helper function to send error
function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, { error: message });
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    // API endpoint: GET /api/tasks
    if (pathname === '/api/tasks' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Read tasks.json
        fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading tasks.json:', err);
                sendError(res, 500, 'Failed to read tasks file');
                return;
            }

            try {
                const tasksData = JSON.parse(data);
                sendJSON(res, 200, tasksData);
            } catch (parseErr) {
                console.error('Error parsing tasks.json:', parseErr);
                sendError(res, 500, 'Failed to parse tasks file');
            }
        });
        return;
    }

    // API endpoint: GET /api/projects
    if (pathname === '/api/projects' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Read projects.json
        fs.readFile(PROJECTS_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading projects.json:', err);
                sendError(res, 500, 'Failed to read projects file');
                return;
            }

            try {
                const projectsData = JSON.parse(data);
                sendJSON(res, 200, projectsData);
            } catch (parseErr) {
                console.error('Error parsing projects.json:', parseErr);
                sendError(res, 500, 'Failed to parse projects file');
            }
        });
        return;
    }

    // Handle 404 for other routes
    sendError(res, 404, 'Not found');
});

// Start server
server.listen(PORT, () => {
    console.log(`Task Manager API server running on port ${PORT}`);
    console.log(`Tasks endpoint: http://localhost:${PORT}/api/tasks`);
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
