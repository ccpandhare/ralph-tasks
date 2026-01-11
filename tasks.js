// Task management functionality
const API_URL = '/api/tasks';

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

// Initialize the page
async function initializePage() {
    const tasks = await fetchTasks();
    renderOpenTasks(tasks);
}

// Load tasks when page loads
if (document.getElementById('taskList')) {
    initializePage();
}
