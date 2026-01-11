const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// Hardcoded password hash for authentication (same as in auth.js)
// Password: 4wJkq5b6fmtuG3Nv1lHxJXYenULuE/j7dW1SksImqZ8=
const PASSWORD_HASH = "e2b4e38fed003ce3e1aceb2d2cff3c606ab8bf13a970e0e02e71b372cf4bd0f6";

// Port configuration
const PORT = process.env.PORT || 3001;

// Path to tasks.json and projects.json
const TASKS_FILE = '/var/main/tasks.json';
const PROJECTS_FILE = '/var/main/projects.json';
const LOGS_FILE = '/var/main/logs/progress.txt';

// Ralph execution tracking
let ralphRunning = false;
let ralphProcess = null;

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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    // API endpoint: POST /api/tasks
    if (pathname === '/api/tasks' && req.method === 'POST') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Collect request body
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const newTask = JSON.parse(body);

                // Validate required fields
                if (!newTask.id || !newTask.project || !newTask.title || !newTask.requirements || !Array.isArray(newTask.requirements)) {
                    sendError(res, 400, 'Invalid task data: missing required fields');
                    return;
                }

                // Ensure status and completed are set
                if (typeof newTask.status !== 'boolean' || typeof newTask.completed !== 'boolean') {
                    sendError(res, 400, 'Invalid task data: status and completed must be boolean');
                    return;
                }

                // Read existing tasks
                fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
                    if (err) {
                        console.error('Error reading tasks.json:', err);
                        sendError(res, 500, 'Failed to read tasks file');
                        return;
                    }

                    try {
                        const tasksData = JSON.parse(data);

                        // Check if task ID already exists
                        const existingTask = tasksData.tasks.find(t => t.id === newTask.id);
                        if (existingTask) {
                            sendError(res, 409, 'Task ID already exists');
                            return;
                        }

                        // Append new task
                        tasksData.tasks.push(newTask);

                        // Write atomically using temporary file
                        const tmpFile = TASKS_FILE + '.tmp';
                        const jsonContent = JSON.stringify(tasksData, null, 2) + '\n';

                        fs.writeFile(tmpFile, jsonContent, 'utf8', (writeErr) => {
                            if (writeErr) {
                                console.error('Error writing temp file:', writeErr);
                                sendError(res, 500, 'Failed to write tasks file');
                                return;
                            }

                            // Atomically rename temp file to actual file
                            fs.rename(tmpFile, TASKS_FILE, (renameErr) => {
                                if (renameErr) {
                                    console.error('Error renaming temp file:', renameErr);
                                    // Clean up temp file
                                    fs.unlink(tmpFile, () => {});
                                    sendError(res, 500, 'Failed to save tasks file');
                                    return;
                                }

                                // Success!
                                sendJSON(res, 201, { success: true, task: newTask });
                            });
                        });
                    } catch (parseErr) {
                        console.error('Error parsing tasks.json:', parseErr);
                        sendError(res, 500, 'Failed to parse tasks file');
                    }
                });
            } catch (parseErr) {
                console.error('Error parsing request body:', parseErr);
                sendError(res, 400, 'Invalid JSON in request body');
            }
        });

        return;
    }

    // API endpoint: PUT /api/tasks/:taskId
    if (pathname.startsWith('/api/tasks/') && req.method === 'PUT') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Extract task ID from URL
        const taskId = pathname.substring('/api/tasks/'.length);

        // Collect request body
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const updateData = JSON.parse(body);

                // Read existing tasks
                fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
                    if (err) {
                        console.error('Error reading tasks.json:', err);
                        sendError(res, 500, 'Failed to read tasks file');
                        return;
                    }

                    try {
                        const tasksData = JSON.parse(data);

                        // Find task by ID
                        const taskIndex = tasksData.tasks.findIndex(t => t.id === taskId);
                        if (taskIndex === -1) {
                            sendError(res, 404, 'Task not found');
                            return;
                        }

                        // Update task fields
                        const task = tasksData.tasks[taskIndex];
                        if (typeof updateData.status === 'boolean') {
                            task.status = updateData.status;
                        }
                        if (typeof updateData.completed === 'boolean') {
                            task.completed = updateData.completed;
                        }

                        // Write atomically using temporary file
                        const tmpFile = TASKS_FILE + '.tmp';
                        const jsonContent = JSON.stringify(tasksData, null, 2) + '\n';

                        fs.writeFile(tmpFile, jsonContent, 'utf8', (writeErr) => {
                            if (writeErr) {
                                console.error('Error writing temp file:', writeErr);
                                sendError(res, 500, 'Failed to write tasks file');
                                return;
                            }

                            // Atomically rename temp file to actual file
                            fs.rename(tmpFile, TASKS_FILE, (renameErr) => {
                                if (renameErr) {
                                    console.error('Error renaming temp file:', renameErr);
                                    // Clean up temp file
                                    fs.unlink(tmpFile, () => {});
                                    sendError(res, 500, 'Failed to save tasks file');
                                    return;
                                }

                                // Success!
                                sendJSON(res, 200, { success: true, task: task });
                            });
                        });
                    } catch (parseErr) {
                        console.error('Error parsing tasks.json:', parseErr);
                        sendError(res, 500, 'Failed to parse tasks file');
                    }
                });
            } catch (parseErr) {
                console.error('Error parsing request body:', parseErr);
                sendError(res, 400, 'Invalid JSON in request body');
            }
        });

        return;
    }

    // API endpoint: POST /api/ralph/execute
    if (pathname === '/api/ralph/execute' && req.method === 'POST') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Check if Ralph is already running
        if (ralphRunning) {
            sendError(res, 409, 'Ralph is already running');
            return;
        }

        // Mark Ralph as running
        ralphRunning = true;

        // Execute ralph-once.sh
        const ralphScript = '/var/main/scripts/ralph-once.sh';
        ralphProcess = spawn('bash', [ralphScript], {
            cwd: '/var/main',
            stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        ralphProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        ralphProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ralphProcess.on('close', (code) => {
            ralphRunning = false;
            ralphProcess = null;
            console.log(`Ralph execution completed with code ${code}`);
            if (code !== 0) {
                console.error('Ralph error output:', errorOutput);
            }
        });

        ralphProcess.on('error', (err) => {
            ralphRunning = false;
            ralphProcess = null;
            console.error('Ralph process error:', err);
        });

        // Return immediately after starting
        sendJSON(res, 202, {
            success: true,
            message: 'Ralph execution started',
            status: 'running'
        });
        return;
    }

    // API endpoint: GET /api/ralph/status
    if (pathname === '/api/ralph/status' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        sendJSON(res, 200, {
            running: ralphRunning,
            status: ralphRunning ? 'running' : 'idle'
        });
        return;
    }

    // API endpoint: GET /api/ralph/logs
    if (pathname === '/api/ralph/logs' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Read logs file
        fs.readFile(LOGS_FILE, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // File doesn't exist yet
                    sendJSON(res, 200, { logs: '', exists: false });
                } else {
                    console.error('Error reading logs file:', err);
                    sendError(res, 500, 'Failed to read logs file');
                }
                return;
            }

            sendJSON(res, 200, { logs: data, exists: true });
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
