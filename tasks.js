// Task management functionality
const API_URL = '/api/tasks';
const RALPH_API_URL = '/api/ralph';

// Update task (mark as complete)
async function updateTask(taskId, updateData) {
    const token = getAuthToken();
    if (!token) {
        console.error('No authentication token available');
        return { success: false, error: 'Not authenticated' };
    }

    try {
        const response = await fetch(`${API_URL}/${taskId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, task: data.task };
    } catch (error) {
        console.error('Error updating task:', error);
        return { success: false, error: error.message };
    }
}

// Mark task as complete with confirmation
async function markTaskComplete(taskId, taskTitle) {
    // Show confirmation dialog
    const confirmed = confirm(`Mark task as complete?\n\n"${taskTitle}"\n\nThis will set both status and completed fields to true.`);

    if (!confirmed) {
        return;
    }

    // Show loading message
    showMessage('Marking task as complete...', 'info');

    // Call API to update task
    const result = await updateTask(taskId, {
        status: true,
        completed: true
    });

    if (result.success) {
        showMessage('Task marked as complete successfully!', 'success');
        // Refresh the task list
        setTimeout(() => {
            initializePage();
        }, 1000);
    } else {
        showMessage(`Error: ${result.error}`, 'error');
    }
}

// Show message to user
function showMessage(text, type) {
    // Check if message container exists, create if not
    let messageDiv = document.getElementById('messageContainer');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'messageContainer';
        messageDiv.className = 'message-container';
        const mainContent = document.querySelector('main');
        mainContent.insertBefore(messageDiv, mainContent.firstChild);
    }

    // Set message content and type
    messageDiv.textContent = text;
    messageDiv.className = `message-container message-${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 5 seconds for success/error messages
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    } else if (type === 'info') {
        // Keep info messages visible
    }
}

// Fetch tasks from API
async function fetchTasks() {
    const token = getAuthToken();
    if (!token) {
        console.error('No authentication token available');
        return null;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.tasks;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return null;
    }
}

// Group tasks by project
function groupTasksByProject(tasks) {
    const grouped = {};
    tasks.forEach(task => {
        if (!grouped[task.project]) {
            grouped[task.project] = [];
        }
        grouped[task.project].push(task);
    });
    return grouped;
}

// Toggle task requirements visibility
function toggleRequirements(taskId) {
    const reqList = document.getElementById(`req-${taskId}`);
    const toggleBtn = document.getElementById(`toggle-${taskId}`);

    if (reqList.classList.contains('hidden')) {
        reqList.classList.remove('hidden');
        toggleBtn.textContent = '▼';
    } else {
        reqList.classList.add('hidden');
        toggleBtn.textContent = '▶';
    }
}

// Render open tasks
function renderOpenTasks(tasks) {
    const taskList = document.getElementById('taskList');

    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<p class="no-tasks">No tasks found.</p>';
        return;
    }

    // Filter for open tasks (completed = false)
    const openTasks = tasks.filter(task => !task.completed);

    if (openTasks.length === 0) {
        taskList.innerHTML = '<p class="no-tasks">No open tasks! All tasks are completed.</p>';
        return;
    }

    // Group by project
    const grouped = groupTasksByProject(openTasks);

    let html = '';

    Object.keys(grouped).sort().forEach(projectName => {
        const projectTasks = grouped[projectName];

        html += `
            <div class="project-group">
                <h3 class="project-title">${projectName}</h3>
                <div class="project-tasks">
        `;

        projectTasks.forEach(task => {
            const statusClass = task.status ? 'status-met' : 'status-not-met';
            const statusText = task.status ? 'Requirements Met' : 'Requirements Not Met';

            html += `
                <div class="task-card">
                    <div class="task-header">
                        <div class="task-title-row">
                            <span class="task-id">${task.id}</span>
                            <h4 class="task-title">${task.title}</h4>
                        </div>
                        <span class="task-status ${statusClass}">${statusText}</span>
                    </div>

                    <div class="task-requirements">
                        <div class="requirements-header">
                            <strong>Requirements:</strong>
                            <button class="toggle-btn" id="toggle-${task.id}" onclick="toggleRequirements('${task.id}')">▶</button>
                        </div>
                        <ul class="requirements-list hidden" id="req-${task.id}">
            `;

            task.requirements.forEach(req => {
                html += `<li>${req}</li>`;
            });

            html += `
                        </ul>
                    </div>
            `;

            if (task.notes && task.notes.trim() !== '') {
                html += `
                    <div class="task-notes">
                        <strong>Notes:</strong> ${task.notes}
                    </div>
                `;
            }

            html += `
                    <div class="task-meta">
                        <span>Created: ${task.created}</span>
                    </div>
                    <div class="task-actions">
                        <button class="btn-edit" onclick="window.location.href='edit-task.html?id=${task.id}'">
                            Edit Task
                        </button>
                        <button class="btn-complete" onclick="markTaskComplete('${task.id}', '${task.title.replace(/'/g, "\\'")}')">
                            Mark as Complete
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    taskList.innerHTML = html;
}

// Render completed tasks
function renderCompletedTasks(tasks) {
    const taskList = document.getElementById('taskList');

    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<p class="no-tasks">No tasks found.</p>';
        return;
    }

    // Filter for completed tasks (completed = true)
    const completedTasks = tasks.filter(task => task.completed);

    if (completedTasks.length === 0) {
        taskList.innerHTML = '<p class="no-tasks">No completed tasks yet.</p>';
        return;
    }

    // Group by project
    const grouped = groupTasksByProject(completedTasks);

    let html = '';

    Object.keys(grouped).sort().forEach(projectName => {
        const projectTasks = grouped[projectName];

        html += `
            <div class="project-group">
                <h3 class="project-title">${projectName}</h3>
                <div class="project-tasks">
        `;

        projectTasks.forEach(task => {
            html += `
                <div class="task-card completed-task">
                    <div class="task-header">
                        <div class="task-title-row">
                            <span class="task-id">${task.id}</span>
                            <h4 class="task-title">${task.title}</h4>
                        </div>
                        <span class="task-status status-completed">Completed</span>
                    </div>

                    <div class="task-meta-info">
                        <span class="meta-item">Created: ${task.created}</span>
                        <span class="meta-item">Project: ${task.project}</span>
                    </div>

                    <div class="task-requirements">
                        <div class="requirements-header">
                            <strong>Requirements:</strong>
                            <button class="toggle-btn" id="toggle-${task.id}" onclick="toggleRequirements('${task.id}')">▶</button>
                        </div>
                        <ul class="requirements-list hidden" id="req-${task.id}">
            `;

            task.requirements.forEach(req => {
                html += `<li>${req}</li>`;
            });

            html += `
                        </ul>
                    </div>
            `;

            if (task.notes && task.notes.trim() !== '') {
                html += `
                    <div class="task-notes">
                        <strong>Notes:</strong> ${task.notes}
                    </div>
                `;
            }

            html += `
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    taskList.innerHTML = html;
}

// Store current view and tasks
let currentView = 'open';
let allTasks = null;

// Show open tasks view
function showOpenTasks() {
    currentView = 'open';
    document.getElementById('openTasksBtn').classList.add('active');
    document.getElementById('completedTasksBtn').classList.remove('active');
    if (allTasks) {
        renderOpenTasks(allTasks);
    }
}

// Show completed tasks view
function showCompletedTasks() {
    currentView = 'completed';
    document.getElementById('completedTasksBtn').classList.add('active');
    document.getElementById('openTasksBtn').classList.remove('active');
    if (allTasks) {
        renderCompletedTasks(allTasks);
    }
}

// Initialize the page
async function initializePage() {
    const tasks = await fetchTasks();
    allTasks = tasks;
    if (currentView === 'open') {
        renderOpenTasks(tasks);
    } else {
        renderCompletedTasks(tasks);
    }
}

// Ralph execution functions
async function executeRalph() {
    const token = getAuthToken();
    if (!token) {
        console.error('No authentication token available');
        showMessage('Not authenticated', 'error');
        return;
    }

    // Confirm action
    const confirmed = confirm('Start Ralph execution?\n\nRalph will work on the most important task automatically.\n\nThis may take several minutes.');
    if (!confirmed) {
        return;
    }

    // Show loading message
    showMessage('Starting Ralph execution...', 'info');

    try {
        const response = await fetch(`${RALPH_API_URL}/execute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        showMessage('Ralph execution started! Redirecting to execution logs...', 'success');

        // Redirect to Ralph logs page after a short delay
        setTimeout(() => {
            window.location.href = 'ralph-logs.html';
        }, 1000);
    } catch (error) {
        console.error('Error starting Ralph:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function checkRalphStatus() {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    try {
        const response = await fetch(`${RALPH_API_URL}/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error checking Ralph status:', error);
        return null;
    }
}

let ralphStatusInterval = null;

function startRalphStatusPolling() {
    // Clear any existing interval
    if (ralphStatusInterval) {
        clearInterval(ralphStatusInterval);
    }

    // Update button state
    updateRalphButton(true);

    // Poll every 3 seconds
    ralphStatusInterval = setInterval(async () => {
        const status = await checkRalphStatus();

        if (status && !status.running) {
            // Ralph finished
            clearInterval(ralphStatusInterval);
            ralphStatusInterval = null;
            updateRalphButton(false);
            showMessage('Ralph execution completed! Refreshing task list...', 'success');

            // Refresh task list after 2 seconds
            setTimeout(() => {
                initializePage();
            }, 2000);
        }
    }, 3000);
}

function updateRalphButton(running) {
    const ralphBtn = document.getElementById('ralphBtn');
    if (!ralphBtn) return;

    if (running) {
        ralphBtn.textContent = 'Ralph Running...';
        ralphBtn.disabled = true;
        ralphBtn.classList.add('disabled');
    } else {
        ralphBtn.textContent = 'Run Ralph';
        ralphBtn.disabled = false;
        ralphBtn.classList.remove('disabled');
    }
}

// Check Ralph status on page load
async function checkInitialRalphStatus() {
    const status = await checkRalphStatus();
    if (status && status.running) {
        updateRalphButton(true);
        startRalphStatusPolling();
        showMessage('Ralph is currently running...', 'info');
    }
}

// Auto-run status functions
let autoStatusInterval = null;

async function fetchAutoStatus() {
    const token = sessionStorage.getItem('authToken');
    if (!token) return null;

    try {
        const response = await fetch(`${API_BASE}/ralph/auto-status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch auto-run status:', error);
        return null;
    }
}

function updateAutoRunDisplay(status) {
    if (!status) return;

    // Update watcher status
    const watcherStatusEl = document.getElementById('watcherStatus');
    const watcherToggleBtn = document.getElementById('watcherToggleBtn');
    if (watcherStatusEl) {
        if (status.watcherRunning) {
            watcherStatusEl.textContent = 'Active';
            watcherStatusEl.className = 'auto-run-badge active';
            if (watcherToggleBtn) {
                watcherToggleBtn.textContent = 'Stop';
                watcherToggleBtn.style.display = 'inline-block';
            }
        } else {
            watcherStatusEl.textContent = 'Stopped';
            watcherStatusEl.className = 'auto-run-badge inactive';
            if (watcherToggleBtn) {
                watcherToggleBtn.textContent = 'Start';
                watcherToggleBtn.style.display = 'inline-block';
            }
        }
    }

    // Update executing status
    const executingStatusEl = document.getElementById('executingStatus');
    const executingPidEl = document.getElementById('executingPid');
    if (executingStatusEl) {
        if (status.ralphExecuting) {
            executingStatusEl.textContent = 'Running';
            executingStatusEl.className = 'auto-run-badge executing';
            if (executingPidEl && status.currentPid) {
                executingPidEl.textContent = `PID: ${status.currentPid}`;
            }
        } else {
            executingStatusEl.textContent = 'Idle';
            executingStatusEl.className = 'auto-run-badge inactive';
            if (executingPidEl) {
                executingPidEl.textContent = '';
            }
        }
    }

    // Update last run time
    const lastRunTimeEl = document.getElementById('lastRunTime');
    if (lastRunTimeEl) {
        if (status.lastRunTime) {
            lastRunTimeEl.textContent = formatTimestamp(status.lastRunTime);
        } else {
            lastRunTimeEl.textContent = 'Never';
        }
    }
}

function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hrs ago`;
        return date.toLocaleString();
    } catch (e) {
        return timestamp;
    }
}

async function refreshAutoStatus() {
    const refreshBtn = document.getElementById('refreshAutoStatusBtn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(360deg)';
        refreshBtn.style.transition = 'transform 0.5s ease';
        setTimeout(() => {
            refreshBtn.style.transform = '';
        }, 500);
    }

    const status = await fetchAutoStatus();
    updateAutoRunDisplay(status);
}

function startAutoStatusPolling() {
    // Initial fetch
    refreshAutoStatus();

    // Poll every 10 seconds
    if (autoStatusInterval) {
        clearInterval(autoStatusInterval);
    }
    autoStatusInterval = setInterval(refreshAutoStatus, 10000);
}

async function toggleWatcher() {
    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    const watcherStatusEl = document.getElementById('watcherStatus');
    const isActive = watcherStatusEl && watcherStatusEl.classList.contains('active');

    const endpoint = isActive ? '/ralph/auto/stop' : '/ralph/auto/start';
    const action = isActive ? 'stop' : 'start';

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to ${action} watcher`);
        }

        const result = await response.json();
        showMessage(result.message, 'success');

        // Refresh status after 1 second
        setTimeout(refreshAutoStatus, 1000);
    } catch (error) {
        console.error(`Failed to ${action} watcher:`, error);
        showMessage(`Failed to ${action} file watcher`, 'error');
    }
}

// Toggle more options panel
function toggleMoreOptions() {
    const panel = document.getElementById('moreOptionsPanel');
    const btn = document.getElementById('moreOptionsBtn');
    if (!panel || !btn) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        btn.textContent = 'Less Options ▴';
    } else {
        panel.classList.add('hidden');
        btn.textContent = 'More Options ▾';
    }
}

// Load tasks when page loads
if (document.getElementById('taskList')) {
    initializePage();
    checkInitialRalphStatus();
    startAutoStatusPolling();
}
