// Ralph Auto-Run Logs JavaScript

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

let currentLogType = 'auto-run';
let autoRefreshInterval = null;

// Build request headers (use Bearer token for tests, otherwise rely on cookies)
function buildAutoHeaders() {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Fetch auto-run status
async function fetchAutoStatus() {
    try {
        const response = await fetch(`${API_BASE}/ralph/auto-status`, {
            headers: buildAutoHeaders(),
            credentials: 'include'
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

// Fetch auto-run logs
async function fetchAutoLogs(type = 'auto-run', limit = 500) {
    try {
        const response = await fetch(`${API_BASE}/ralph/auto-logs?type=${type}&limit=${limit}`, {
            headers: buildAutoHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch auto-run logs:', error);
        return null;
    }
}

// Update status overview
function updateStatusOverview(status) {
    if (!status) return;

    const watcherStatusEl = document.getElementById('watcherStatusOverview');
    const watcherToggleBtn = document.getElementById('watcherToggleBtnOverview');
    if (watcherStatusEl) {
        if (status.watcherRunning) {
            watcherStatusEl.textContent = 'Active ✓';
            watcherStatusEl.className = 'overview-value success';
            if (watcherToggleBtn) {
                watcherToggleBtn.textContent = 'Stop Watcher';
                watcherToggleBtn.classList.add('btn-danger');
                watcherToggleBtn.classList.remove('btn-primary');
            }
        } else {
            watcherStatusEl.textContent = 'Stopped';
            watcherStatusEl.className = 'overview-value inactive';
            if (watcherToggleBtn) {
                watcherToggleBtn.textContent = 'Start Watcher';
                watcherToggleBtn.classList.add('btn-primary');
                watcherToggleBtn.classList.remove('btn-danger');
            }
        }
    }

    const executingStatusEl = document.getElementById('executingStatusOverview');
    if (executingStatusEl) {
        if (status.ralphExecuting) {
            executingStatusEl.textContent = `Running (PID: ${status.currentPid || 'unknown'})`;
            executingStatusEl.className = 'overview-value running';
        } else {
            executingStatusEl.textContent = 'Idle';
            executingStatusEl.className = 'overview-value';
        }
    }

    const lastRunTimeEl = document.getElementById('lastRunTimeOverview');
    if (lastRunTimeEl) {
        if (status.lastRunTime) {
            lastRunTimeEl.textContent = formatTimestamp(status.lastRunTime);
            lastRunTimeEl.className = 'overview-value';
        } else {
            lastRunTimeEl.textContent = 'Never';
            lastRunTimeEl.className = 'overview-value inactive';
        }
    }
}

// Format timestamp
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

// Update log content
function updateLogContent(logData) {
    const logContentEl = document.getElementById('logContent');
    const logInfoEl = document.getElementById('logInfo');
    const logTitleEl = document.getElementById('logTitle');

    if (!logData) {
        logContentEl.textContent = 'Failed to load logs';
        logInfoEl.textContent = 'Error';
        return;
    }

    const logTitles = {
        'auto-run': 'Auto-Run Activity Log',
        'watcher': 'File Watcher Log',
        'cron': 'Cron Job Log'
    };

    if (logTitleEl) {
        logTitleEl.textContent = logTitles[logData.type] || 'Log';
    }

    if (!logData.exists) {
        logContentEl.textContent = logData.message || 'No logs available yet';
        logInfoEl.textContent = 'Empty';
        return;
    }

    // Apply syntax highlighting
    const highlighted = highlightLog(logData.content);
    logContentEl.innerHTML = highlighted;

    logInfoEl.textContent = `${logData.returnedLines} lines (of ${logData.totalLines} total)`;

    // Auto-scroll to bottom
    logContentEl.scrollTop = logContentEl.scrollHeight;
}

// Highlight log content
function highlightLog(content) {
    if (!content) return '';

    // Escape HTML
    let escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Highlight patterns
    escaped = escaped
        // Timestamps [YYYY-MM-DD HH:MM:SS]
        .replace(/(\[[\d\-: ]+\])/g, '<span class="log-timestamp">$1</span>')
        // Success messages
        .replace(/(✓|✔|success|SUCCESS|completed|COMPLETED)/gi, '<span class="log-success">$1</span>')
        // Error messages
        .replace(/(✗|✘|error|ERROR|failed|FAILED)/gi, '<span class="log-error">$1</span>')
        // Info messages
        .replace(/(Starting|Stopping|Triggered|Monitoring|Waiting)/gi, '<span class="log-info">$1</span>')
        // File paths
        .replace(/(\/[\w\/\-\.]+)/g, '<span class="log-path">$1</span>')
        // PIDs
        .replace(/(PID:?\s*\d+)/gi, '<span class="log-detail">$1</span>');

    return escaped;
}

// Select log type
function selectLogType(type) {
    currentLogType = type;

    // Update button states
    document.querySelectorAll('.log-type-btn').forEach(btn => {
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Load logs for selected type
    refreshCurrentLog();
}

// Refresh current log
async function refreshCurrentLog() {
    const logData = await fetchAutoLogs(currentLogType);
    updateLogContent(logData);
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const checkbox = document.getElementById('autoRefreshToggle');

    if (checkbox.checked) {
        // Start auto-refresh every 3 seconds
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = setInterval(() => {
            refreshCurrentLog();
            updateStatus();
        }, 3000);
    } else {
        // Stop auto-refresh
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
}

// Toggle watcher
async function toggleWatcher() {
    const watcherStatusEl = document.getElementById('watcherStatusOverview');
    const isActive = watcherStatusEl && watcherStatusEl.classList.contains('success');

    const endpoint = isActive ? '/ralph/auto/stop' : '/ralph/auto/start';
    const action = isActive ? 'stop' : 'start';

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: buildAutoHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to ${action} watcher`);
        }

        const result = await response.json();
        alert(result.message);

        // Refresh status after 1 second
        setTimeout(updateStatus, 1000);
    } catch (error) {
        console.error(`Failed to ${action} watcher:`, error);
        alert(`Failed to ${action} file watcher`);
    }
}

// Update status
async function updateStatus() {
    const status = await fetchAutoStatus();
    updateStatusOverview(status);
}

// Initialize page
async function initializePage() {
    // Load initial data
    await updateStatus();
    await refreshCurrentLog();

    // Enable auto-refresh by default
    const checkbox = document.getElementById('autoRefreshToggle');
    if (checkbox) {
        checkbox.checked = true;
        toggleAutoRefresh();
    }
}

// Load when page loads
initializePage();
