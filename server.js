require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// Load password hashes from environment variables
const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;
const TEST_PASSWORD_HASH = process.env.TEST_AUTH_PASSWORD_HASH;

if (!PASSWORD_HASH) {
    console.error('ERROR: AUTH_PASSWORD_HASH environment variable is not set');
    console.error('Please ensure .env file exists with AUTH_PASSWORD_HASH defined');
    process.exit(1);
}

// Helper function to get the correct file paths based on account type
function getFilePaths(isTestAccount) {
    if (isTestAccount) {
        return {
            tasksFile: TEST_TASKS_FILE,
            projectsFile: TEST_PROJECTS_FILE
        };
    }
    return {
        tasksFile: TASKS_FILE,
        projectsFile: PROJECTS_FILE
    };
}

// Port configuration
const PORT = process.env.PORT || 3001;

// Path to tasks.json and projects.json
const TASKS_FILE = '/var/main/tasks.json';
const PROJECTS_FILE = '/var/main/projects.json';
const LOGS_FILE = '/var/main/logs/progress.txt';

// Test account files (in application directory, not production directory)
const TEST_TASKS_FILE = path.join(__dirname, 'test-tasks.json');
const TEST_PROJECTS_FILE = path.join(__dirname, 'test-projects.json');

// Ralph execution tracking
let ralphRunning = false;
let ralphProcess = null;
let currentRalphLogFile = null;

// Helper function to check authentication and determine account type
function getAuthInfo(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return { authenticated: false, isTestAccount: false };

    // Expect format: "Bearer <password_hash>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return { authenticated: false, isTestAccount: false };

    const token = parts[1];

    // Check if it's the test account
    if (TEST_PASSWORD_HASH && token === TEST_PASSWORD_HASH) {
        return { authenticated: true, isTestAccount: true };
    }

    // Check if it's the production account
    if (token === PASSWORD_HASH) {
        return { authenticated: true, isTestAccount: false };
    }

    return { authenticated: false, isTestAccount: false };
}

// Legacy helper for backward compatibility
function isAuthenticated(req) {
    return getAuthInfo(req).authenticated;
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
        const authInfo = getAuthInfo(req);
        if (!authInfo.authenticated) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Get file path based on account type
        const { tasksFile } = getFilePaths(authInfo.isTestAccount);

        // Read tasks from appropriate file
        fs.readFile(tasksFile, 'utf8', (err, data) => {
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
        const authInfo = getAuthInfo(req);
        if (!authInfo.authenticated) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Get file path based on account type
        const { projectsFile } = getFilePaths(authInfo.isTestAccount);

        // Read projects from appropriate file
        fs.readFile(projectsFile, 'utf8', (err, data) => {
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
        const authInfo = getAuthInfo(req);
        if (!authInfo.authenticated) {
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

                // Get file path based on account type
                const { tasksFile } = getFilePaths(authInfo.isTestAccount);

                // Read existing tasks from appropriate file
                fs.readFile(tasksFile, 'utf8', (err, data) => {
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
                        const tmpFile = tasksFile + '.tmp';
                        const jsonContent = JSON.stringify(tasksData, null, 2) + '\n';

                        fs.writeFile(tmpFile, jsonContent, 'utf8', (writeErr) => {
                            if (writeErr) {
                                console.error('Error writing temp file:', writeErr);
                                sendError(res, 500, 'Failed to write tasks file');
                                return;
                            }

                            // Atomically rename temp file to actual file
                            fs.rename(tmpFile, tasksFile, (renameErr) => {
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
        const authInfo = getAuthInfo(req);
        if (!authInfo.authenticated) {
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

                // Get file path based on account type
                const { tasksFile } = getFilePaths(authInfo.isTestAccount);

                // Read existing tasks from appropriate file
                fs.readFile(tasksFile, 'utf8', (err, data) => {
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
                        const tmpFile = tasksFile + '.tmp';
                        const jsonContent = JSON.stringify(tasksData, null, 2) + '\n';

                        fs.writeFile(tmpFile, jsonContent, 'utf8', (writeErr) => {
                            if (writeErr) {
                                console.error('Error writing temp file:', writeErr);
                                sendError(res, 500, 'Failed to write tasks file');
                                return;
                            }

                            // Atomically rename temp file to actual file
                            fs.rename(tmpFile, tasksFile, (renameErr) => {
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

    // API endpoint: POST /api/test/reset (test account only)
    if (pathname === '/api/test/reset' && req.method === 'POST') {
        // Check authentication - must be test account
        const authInfo = getAuthInfo(req);
        if (!authInfo.authenticated || !authInfo.isTestAccount) {
            sendError(res, 403, 'Forbidden: This endpoint is only available for test accounts');
            return;
        }

        // Define initial test data
        const initialTasksData = {
            version: "1.0",
            tasks: [
                {
                    id: "test-001",
                    project: "test-project",
                    title: "Test Task 1",
                    requirements: ["Requirement 1", "Requirement 2"],
                    status: false,
                    completed: false,
                    created: "2026-01-12",
                    notes: "Test notes"
                },
                {
                    id: "test-002",
                    project: "test-project",
                    title: "Test Task 2",
                    requirements: ["Requirement A", "Requirement B"],
                    status: true,
                    completed: false,
                    created: "2026-01-12",
                    notes: ""
                },
                {
                    id: "test-003",
                    project: "test-project",
                    title: "Completed Test Task",
                    requirements: ["Requirement X"],
                    status: true,
                    completed: true,
                    created: "2026-01-11",
                    notes: ""
                }
            ]
        };

        const initialProjectsData = {
            version: "1.0",
            projects: {
                "test-project": {
                    name: "test-project",
                    location: "/tmp/test-project",
                    description: "Test Project",
                    type: "test",
                    active: true,
                    deploy_on_completion: false
                }
            }
        };

        // Reset test data files
        fs.writeFile(TEST_TASKS_FILE, JSON.stringify(initialTasksData, null, 2) + '\n', 'utf8', (err) => {
            if (err) {
                console.error('Error resetting test tasks file:', err);
                sendError(res, 500, 'Failed to reset test tasks file');
                return;
            }

            fs.writeFile(TEST_PROJECTS_FILE, JSON.stringify(initialProjectsData, null, 2) + '\n', 'utf8', (err2) => {
                if (err2) {
                    console.error('Error resetting test projects file:', err2);
                    sendError(res, 500, 'Failed to reset test projects file');
                    return;
                }

                sendJSON(res, 200, { success: true, message: 'Test data reset successfully' });
            });
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

        // Create a log file for this Ralph execution
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ralphLogsDir = '/var/main/logs/ralph-runs';
        const currentLogFile = path.join(ralphLogsDir, `ralph-${timestamp}.log`);
        currentRalphLogFile = currentLogFile;

        // Ensure the logs directory exists
        if (!fs.existsSync(ralphLogsDir)) {
            fs.mkdirSync(ralphLogsDir, { recursive: true });
        }

        // Create the log file with header
        const logHeader = `Ralph Execution Log\nStarted: ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`;
        fs.writeFileSync(currentLogFile, logHeader);

        // Execute ralph-once.sh
        const ralphScript = '/var/main/scripts/ralph-once.sh';
        ralphProcess = spawn('bash', [ralphScript], {
            cwd: '/var/main',
            stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        ralphProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            // Stream to log file in real-time
            fs.appendFileSync(currentLogFile, text);
        });

        ralphProcess.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            // Stream to log file in real-time with [STDERR] prefix
            fs.appendFileSync(currentLogFile, `[STDERR] ${text}`);
        });

        ralphProcess.on('close', (code) => {
            ralphRunning = false;
            ralphProcess = null;
            const footer = `\n${'='.repeat(80)}\nCompleted: ${new Date().toISOString()}\nExit Code: ${code}\n`;
            fs.appendFileSync(currentLogFile, footer);
            currentRalphLogFile = null;
            console.log(`Ralph execution completed with code ${code}`);
            if (code !== 0) {
                console.error('Ralph error output:', errorOutput);
            }
        });

        ralphProcess.on('error', (err) => {
            ralphRunning = false;
            ralphProcess = null;
            const errorMsg = `\n[ERROR] Ralph process error: ${err.message}\n`;
            fs.appendFileSync(currentLogFile, errorMsg);
            currentRalphLogFile = null;
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
            status: ralphRunning ? 'running' : 'idle',
            currentLogFile: currentRalphLogFile
        });
        return;
    }

    // API endpoint: GET /api/ralph/current-log
    if (pathname === '/api/ralph/current-log' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Return the current Ralph execution log if running, or the most recent log
        let logFile = currentRalphLogFile;

        if (!logFile) {
            // Find the most recent log file
            const ralphLogsDir = '/var/main/logs/ralph-runs';
            if (fs.existsSync(ralphLogsDir)) {
                const files = fs.readdirSync(ralphLogsDir)
                    .filter(f => f.startsWith('ralph-') && f.endsWith('.log'))
                    .map(f => ({
                        name: f,
                        path: path.join(ralphLogsDir, f),
                        time: fs.statSync(path.join(ralphLogsDir, f)).mtime.getTime()
                    }))
                    .sort((a, b) => b.time - a.time);

                if (files.length > 0) {
                    logFile = files[0].path;
                }
            }
        }

        if (!logFile || !fs.existsSync(logFile)) {
            sendJSON(res, 200, {
                content: '',
                isRunning: ralphRunning,
                message: 'No Ralph execution logs available yet'
            });
            return;
        }

        try {
            const content = fs.readFileSync(logFile, 'utf-8');
            sendJSON(res, 200, {
                content: content,
                isRunning: ralphRunning,
                logFile: path.basename(logFile)
            });
        } catch (err) {
            sendError(res, 500, `Failed to read log file: ${err.message}`);
        }
        return;
    }

    // API endpoint: GET /api/ralph/log-history
    if (pathname === '/api/ralph/log-history' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        const ralphLogsDir = '/var/main/logs/ralph-runs';

        if (!fs.existsSync(ralphLogsDir)) {
            sendJSON(res, 200, { logs: [] });
            return;
        }

        try {
            const files = fs.readdirSync(ralphLogsDir)
                .filter(f => f.startsWith('ralph-') && f.endsWith('.log'))
                .map(f => {
                    const filePath = path.join(ralphLogsDir, f);
                    const stats = fs.statSync(filePath);
                    return {
                        name: f,
                        path: filePath,
                        timestamp: stats.mtime.toISOString(),
                        size: stats.size
                    };
                })
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            sendJSON(res, 200, { logs: files });
        } catch (err) {
            sendError(res, 500, `Failed to read log directory: ${err.message}`);
        }
        return;
    }

    // API endpoint: GET /api/ralph/log/:filename
    if (pathname.startsWith('/api/ralph/log/') && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        const filename = pathname.replace('/api/ralph/log/', '');
        const ralphLogsDir = '/var/main/logs/ralph-runs';
        const logFile = path.join(ralphLogsDir, filename);

        // Security check: ensure the file is within the logs directory
        if (!logFile.startsWith(ralphLogsDir)) {
            sendError(res, 403, 'Access denied');
            return;
        }

        if (!fs.existsSync(logFile)) {
            sendError(res, 404, 'Log file not found');
            return;
        }

        try {
            const content = fs.readFileSync(logFile, 'utf-8');
            sendJSON(res, 200, {
                content: content,
                filename: filename
            });
        } catch (err) {
            sendError(res, 500, `Failed to read log file: ${err.message}`);
        }
        return;
    }

    // API endpoint: GET /api/ralph/logs
    if (pathname === '/api/ralph/logs' && req.method === 'GET') {
        // Check authentication
        if (!isAuthenticated(req)) {
            sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
            return;
        }

        // Parse query parameters for pagination
        const limit = parseInt(parsedUrl.query.limit) || 10; // Default 10 entries per page
        const offset = parseInt(parsedUrl.query.offset) || 0; // Default offset 0

        // Read logs file
        fs.readFile(LOGS_FILE, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // File doesn't exist yet
                    sendJSON(res, 200, { logs: '', exists: false, totalEntries: 0, hasMore: false });
                } else {
                    console.error('Error reading logs file:', err);
                    sendError(res, 500, 'Failed to read logs file');
                }
                return;
            }

            // Parse log sections (each task entry)
            // Sections start with "## [" and end before the next "## [" or "---"
            const sections = [];
            const lines = data.split('\n');
            let currentSection = [];
            let inHeader = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check if this is a section header (## [Date] - task-XXX - Project)
                if (line.trim().startsWith('## [') && line.includes('task-')) {
                    // If we have a current section, save it (unless it's the file header)
                    if (currentSection.length > 0 && !inHeader) {
                        sections.push(currentSection.join('\n'));
                    }
                    // Start new section
                    currentSection = [line];
                    inHeader = false;
                } else if (line.trim() === '---') {
                    // End of section
                    if (currentSection.length > 0) {
                        currentSection.push(line);
                        if (!inHeader) {
                            sections.push(currentSection.join('\n'));
                        }
                        currentSection = [];
                    }
                } else if (line.trim().startsWith('## Codebase Patterns')) {
                    // This is the header section, skip it
                    inHeader = true;
                    currentSection = [];
                } else {
                    // Add line to current section
                    currentSection.push(line);
                }
            }

            // Add last section if exists
            if (currentSection.length > 0 && !inHeader) {
                sections.push(currentSection.join('\n'));
            }

            // Filter out empty sections
            const nonEmptySections = sections.filter(s => s.trim() !== '');

            // Reverse sections to show latest first
            nonEmptySections.reverse();

            // Apply pagination
            const totalEntries = nonEmptySections.length;
            const paginatedSections = nonEmptySections.slice(offset, offset + limit);
            const hasMore = offset + limit < totalEntries;

            // Combine sections (join with newline separator)
            const logs = paginatedSections.join('\n');

            sendJSON(res, 200, {
                logs: logs,
                exists: true,
                totalEntries: totalEntries,
                limit: limit,
                offset: offset,
                hasMore: hasMore,
                returnedEntries: paginatedSections.length
            });
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
