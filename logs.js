// Global state
let rawLogs = '';
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadLogs();
    setupFilterListener();
});

// Check authentication and load logs
function checkAuthAndLoadLogs() {
    if (!isUserAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    loadLogs();
}

// Load logs from API
async function loadLogs() {
    const indicator = document.getElementById('refreshIndicator');
    if (indicator) {
        indicator.style.display = 'inline-block';
    }

    try {
        const response = await fetch('/api/ralph/logs', {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (response.status === 401) {
            // Authentication failed, redirect to login
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        rawLogs = data.logs || '';

        displayLogs(rawLogs);
        updateStats();
    } catch (error) {
        console.error('Error loading logs:', error);
        showError('Failed to load logs. Please try again.');
    } finally {
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// Display logs with syntax highlighting
function displayLogs(logs) {
    const container = document.getElementById('logsContainer');

    if (!logs || logs.trim() === '') {
        container.innerHTML = '<div class="logs-empty">No logs available yet.</div>';
        return;
    }

    // Apply syntax highlighting
    const highlightedLogs = highlightLogs(logs);
    container.innerHTML = highlightedLogs;
}

// Highlight logs with color coding
function highlightLogs(logs) {
    // Split by lines and process each line
    const lines = logs.split('\n');
    let highlighted = '';
    let inSection = false;

    for (let line of lines) {
        // Check if this is a section header (starts with ##)
        if (line.trim().startsWith('## [')) {
            highlighted += `<div class="log-header">${escapeHtml(line)}</div>`;
            inSection = true;
        }
        // Check for separator
        else if (line.trim() === '---') {
            highlighted += '<div class="log-separator"></div>';
            inSection = false;
        }
        // Highlight task IDs
        else if (line.includes('task-')) {
            highlighted += highlightLine(line, 'task-', 'log-task-id');
        }
        // Highlight project names
        else if (line.includes('project:') || line.includes('Project:')) {
            highlighted += highlightLine(line, /(project:|Project:)/i, 'log-project');
        }
        // Highlight requirements
        else if (line.includes('Requirements completed:') || line.trim().startsWith('*') || line.trim().startsWith('-')) {
            highlighted += `<span class="log-requirement">${escapeHtml(line)}</span>\n`;
        }
        // Highlight learnings
        else if (line.includes('Learnings') || line.includes('learning') || line.includes('pattern')) {
            highlighted += `<span class="log-learning">${escapeHtml(line)}</span>\n`;
        }
        // Regular line
        else {
            highlighted += escapeHtml(line) + '\n';
        }
    }

    return highlighted;
}

// Highlight specific parts of a line
function highlightLine(line, pattern, className) {
    const escaped = escapeHtml(line);
    if (typeof pattern === 'string') {
        return `<span class="${className}">${escaped}</span>\n`;
    }
    return `<span class="${className}">${escaped}</span>\n`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update statistics
function updateStats() {
    const statsText = document.getElementById('statsText');

    if (!rawLogs || rawLogs.trim() === '') {
        statsText.textContent = 'No logs available';
        return;
    }

    const lines = rawLogs.split('\n');
    const sections = rawLogs.split('##').filter(s => s.trim() !== '').length - 1; // -1 for title
    const taskMatches = rawLogs.match(/task-\d+/g) || [];
    const uniqueTasks = [...new Set(taskMatches)].length;

    statsText.textContent = `${lines.length} lines | ${sections} log entries | ${uniqueTasks} unique tasks`;
}

// Filter logs
function filterLogs() {
    const filterInput = document.getElementById('filterInput');
    const filterText = filterInput.value.toLowerCase().trim();

    if (!filterText) {
        displayLogs(rawLogs);
        return;
    }

    // Split logs into sections
    const sections = rawLogs.split(/(?=## \[)/);

    // Filter sections that contain the filter text
    const filteredSections = sections.filter(section =>
        section.toLowerCase().includes(filterText)
    );

    const filteredLogs = filteredSections.join('');
    displayLogs(filteredLogs);

    // Update stats for filtered view
    const statsText = document.getElementById('statsText');
    if (filteredLogs.trim() === '') {
        statsText.textContent = 'No matching logs found';
    } else {
        const matchCount = filteredSections.length;
        statsText.textContent = `Showing ${matchCount} matching log entries (filtered)`;
    }
}

// Clear filter
function clearFilter() {
    const filterInput = document.getElementById('filterInput');
    filterInput.value = '';
    displayLogs(rawLogs);
    updateStats();
}

// Setup filter input listener
function setupFilterListener() {
    const filterInput = document.getElementById('filterInput');
    filterInput.addEventListener('input', filterLogs);
}

// Refresh logs manually
function refreshLogs() {
    loadLogs();
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const toggle = document.getElementById('autoRefreshToggle');
    isAutoRefreshEnabled = toggle.checked;

    if (isAutoRefreshEnabled) {
        // Start auto-refresh every 5 seconds
        autoRefreshInterval = setInterval(() => {
            loadLogs();
        }, 5000);
    } else {
        // Stop auto-refresh
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('logsContainer');
    container.innerHTML = `<div class="logs-empty" style="color: #e74c3c;">${escapeHtml(message)}</div>`;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
});
