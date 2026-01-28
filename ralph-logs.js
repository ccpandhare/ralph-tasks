// Check authentication on page load
if (!isAuthenticated()) {
    window.location.href = 'login.html';
}

// Global variables
let autoRefreshInterval = null;
let currentLogFile = null;
let isHistoryVisible = false;

// API base URL
const API_URL = '/api';

// Initialize the page
async function initializePage() {
    await refreshCurrentLog();
    await loadLogHistory();
    setupAutoRefresh();
}

// Refresh the current log
async function refreshCurrentLog() {
    try {
        const response = await fetch(`${API_URL}/ralph/current-log`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        displayLog(data);
        updateStatusIndicator(data.isRunning);

    } catch (error) {
        console.error('Error fetching current log:', error);
        document.getElementById('logViewer').innerHTML =
            `<span class="log-error">Error loading logs: ${error.message}</span>`;
    }
}

// Display log content with syntax highlighting
function displayLog(data) {
    const logViewer = document.getElementById('logViewer');

    if (!data.content || data.content.trim() === '') {
        logViewer.innerHTML = `<p style="color: #9cdcfe;">${data.message || 'No logs available yet.'}</p>`;
        logViewer.classList.remove('live');
        return;
    }

    // Apply syntax highlighting
    const highlighted = highlightLog(data.content);
    logViewer.innerHTML = highlighted;

    // Add live indicator if Ralph is running
    if (data.isRunning) {
        logViewer.classList.add('live');
    } else {
        logViewer.classList.remove('live');
    }

    // Update current log file name
    if (data.logFile) {
        currentLogFile = data.logFile;
        document.getElementById('currentLogTitle').textContent =
            `Current Execution Log: ${data.logFile}`;
    }

    // Auto-scroll to bottom if Ralph is running
    if (data.isRunning) {
        logViewer.scrollTop = logViewer.scrollHeight;
    }
}

// Highlight log content
function highlightLog(content) {
    return content
        .split('\n')
        .map(line => {
            // Headers (Ralph Execution Log, Started, Completed, etc.)
            if (line.startsWith('Ralph Execution Log') ||
                line.startsWith('Started:') ||
                line.startsWith('Completed:') ||
                line.startsWith('Exit Code:') ||
                line.match(/^={3,}/)) {
                return `<span class="log-header">${escapeHtml(line)}</span>`;
            }
            // STDERR lines
            if (line.includes('[STDERR]')) {
                return `<span class="log-stderr">${escapeHtml(line)}</span>`;
            }
            // ERROR lines
            if (line.includes('[ERROR]') || line.toLowerCase().includes('error:')) {
                return `<span class="log-error">${escapeHtml(line)}</span>`;
            }
            // Timestamps
            if (line.match(/\d{4}-\d{2}-\d{2}/)) {
                return `<span class="log-timestamp">${escapeHtml(line)}</span>`;
            }
            // Success indicators
            if (line.includes('✓') || line.includes('success') || line.includes('completed')) {
                return `<span class="log-success">${escapeHtml(line)}</span>`;
            }
            // Default
            return escapeHtml(line);
        })
        .join('\n');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update status indicator
function updateStatusIndicator(isRunning) {
    const indicator = document.getElementById('statusIndicator');
    if (isRunning) {
        indicator.innerHTML = '<span class="status-badge running">Ralph Running</span>';
    } else {
        indicator.innerHTML = '<span class="status-badge stopped">Idle</span>';
    }
}

// Load log history
async function loadLogHistory() {
    try {
        const response = await fetch(`${API_URL}/ralph/log-history`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        displayLogHistory(data.logs);

    } catch (error) {
        console.error('Error fetching log history:', error);
        document.getElementById('historyList').innerHTML =
            `<p class="error">Error loading log history: ${error.message}</p>`;
    }
}

// Display log history
function displayLogHistory(logs) {
    const historyList = document.getElementById('historyList');

    if (!logs || logs.length === 0) {
        historyList.innerHTML = '<p style="color: #666;">No log history available.</p>';
        return;
    }

    historyList.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleString();
        const sizeKB = (log.size / 1024).toFixed(2);
        const isActive = log.name === currentLogFile;

        return `
            <div class="history-item ${isActive ? 'active' : ''}" onclick="loadHistoricalLog('${log.name}')">
                <div class="history-item-name">${log.name}</div>
                <div class="history-item-meta">
                    ${dateStr} • ${sizeKB} KB
                </div>
            </div>
        `;
    }).join('');
}

// Load a historical log file
async function loadHistoricalLog(filename) {
    try {
        const response = await fetch(`${API_URL}/ralph/log/${filename}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        displayLog({
            content: data.content,
            isRunning: false,
            logFile: data.filename
        });

        // Update active state in history list
        currentLogFile = filename;
        await loadLogHistory();

    } catch (error) {
        console.error('Error loading historical log:', error);
        document.getElementById('logViewer').innerHTML =
            `<span class="log-error">Error loading log: ${error.message}</span>`;
    }
}

// Toggle history panel
function toggleHistory() {
    const historyPanel = document.getElementById('historyPanel');
    const toggleBtn = document.getElementById('toggleHistoryBtn');

    isHistoryVisible = !isHistoryVisible;

    if (isHistoryVisible) {
        historyPanel.style.display = 'block';
        toggleBtn.textContent = '📂 Hide History';
        loadLogHistory();
    } else {
        historyPanel.style.display = 'none';
        toggleBtn.textContent = '📂 Show History';
    }
}

// Setup auto-refresh
function setupAutoRefresh() {
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');

    autoRefreshToggle.addEventListener('change', function() {
        if (this.checked) {
            // Start auto-refresh (every 3 seconds)
            autoRefreshInterval = setInterval(refreshCurrentLog, 3000);
        } else {
            // Stop auto-refresh
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });
}

// Initialize page on load
window.addEventListener('DOMContentLoaded', initializePage);
