// Edit Task Form functionality
const API_URL = '/api/tasks';
const PROJECTS_API_URL = '/api/projects';
const RALPH_API_URL = '/api/ralph';

// Get task ID from URL parameters
function getTaskIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Check if Ralph is currently running
async function checkRalphStatus() {
    const token = getAuthToken();
    if (!token) {
        return { running: false };
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
            return { running: false };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error checking Ralph status:', error);
        return { running: false };
    }
}

// Block editing if Ralph is running
async function checkAndBlockIfRalphRunning() {
    const status = await checkRalphStatus();

    if (status.running) {
        // Show blocking message
        const blockMessage = document.getElementById('ralphBlockMessage');
        blockMessage.classList.remove('hidden');

        // Disable form
        const form = document.getElementById('editTaskForm');
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
            if (input.type !== 'button' || input.textContent === 'Update Task') {
                input.disabled = true;
            }
        });

        return true; // Blocked
    }

    return false; // Not blocked
}

// Load projects from API and populate dropdown
async function loadProjects() {
    const token = getAuthToken();
    if (!token) {
        console.error('No authentication token available');
        showError('Authentication required. Please log in.');
        return;
    }

    try {
        const response = await fetch(PROJECTS_API_URL, {
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
        populateProjectDropdown(data.projects);
    } catch (error) {
        console.error('Error loading projects:', error);
        showError('Failed to load projects. Please refresh the page.');
    }
}

// Populate project dropdown
function populateProjectDropdown(projects) {
    const projectSelect = document.getElementById('project');

    Object.keys(projects).sort().forEach(projectKey => {
        const project = projects[projectKey];
        if (project.active) {
            const option = document.createElement('option');
            option.value = project.name;
            option.textContent = `${project.name} - ${project.description}`;
            projectSelect.appendChild(option);
        }
    });
}

// Load task data from API
async function loadTaskData(taskId) {
    const token = getAuthToken();
    if (!token) {
        console.error('No authentication token available');
        showError('Authentication required. Please log in.');
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
        const task = data.tasks.find(t => t.id === taskId);

        if (!task) {
            throw new Error('Task not found');
        }

        return task;
    } catch (error) {
        console.error('Error loading task:', error);
        showError('Failed to load task. Please try again.');
        return null;
    }
}

// Populate form with task data
function populateForm(task) {
    document.getElementById('taskId').value = task.id;
    document.getElementById('project').value = task.project;
    document.getElementById('title').value = task.title;
    document.getElementById('notes').value = task.notes || '';
    document.getElementById('status').value = String(task.status);

    // Populate requirements
    const requirementsList = document.getElementById('requirementsList');
    requirementsList.innerHTML = '';

    task.requirements.forEach(req => {
        const requirementItem = document.createElement('div');
        requirementItem.className = 'requirement-item';

        requirementItem.innerHTML = `
            <input type="text" class="requirement-input" placeholder="Enter requirement" required value="${escapeHtml(req)}">
            <button type="button" class="btn btn-remove" onclick="removeRequirement(this)">Remove</button>
        `;

        requirementsList.appendChild(requirementItem);
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add a new requirement input field
function addRequirement() {
    const requirementsList = document.getElementById('requirementsList');

    const requirementItem = document.createElement('div');
    requirementItem.className = 'requirement-item';

    requirementItem.innerHTML = `
        <input type="text" class="requirement-input" placeholder="Enter requirement" required>
        <button type="button" class="btn btn-remove" onclick="removeRequirement(this)">Remove</button>
    `;

    requirementsList.appendChild(requirementItem);
}

// Remove a requirement input field
function removeRequirement(button) {
    const requirementsList = document.getElementById('requirementsList');
    const requirementItems = requirementsList.querySelectorAll('.requirement-item');

    // Don't allow removing the last requirement
    if (requirementItems.length <= 1) {
        showError('At least one requirement is required.');
        return;
    }

    button.parentElement.remove();
    hideError();
}

// Validate form inputs
function validateForm() {
    const project = document.getElementById('project').value.trim();
    const title = document.getElementById('title').value.trim();
    const requirementInputs = document.querySelectorAll('.requirement-input');

    if (!project) {
        showError('Please select a project.');
        return false;
    }

    if (!title) {
        showError('Please enter a task title.');
        return false;
    }

    // Check if at least one requirement is filled
    let hasRequirement = false;
    requirementInputs.forEach(input => {
        if (input.value.trim()) {
            hasRequirement = true;
        }
    });

    if (!hasRequirement) {
        showError('Please add at least one requirement.');
        return false;
    }

    return true;
}

// Collect requirements from input fields
function collectRequirements() {
    const requirementInputs = document.querySelectorAll('.requirement-input');
    const requirements = [];

    requirementInputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            requirements.push(value);
        }
    });

    return requirements;
}

// Show success message
function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.querySelector('p').textContent = message;
    successMessage.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        successMessage.classList.add('hidden');
    }, 5000);
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.querySelector('p').textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.classList.add('hidden');
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();

    hideError();

    // Check if Ralph is running before allowing edit
    const isBlocked = await checkAndBlockIfRalphRunning();
    if (isBlocked) {
        showError('Cannot update task while Ralph is running.');
        return;
    }

    // Validate form
    if (!validateForm()) {
        return;
    }

    // Get form data
    const taskId = document.getElementById('taskId').value.trim();
    const project = document.getElementById('project').value.trim();
    const title = document.getElementById('title').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const status = document.getElementById('status').value === 'true';
    const requirements = collectRequirements();

    // Create update object (all fields except id and created date)
    const updateData = {
        project: project,
        title: title,
        requirements: requirements,
        status: status,
        notes: notes
    };

    // Submit to API
    const token = getAuthToken();
    if (!token) {
        showError('Authentication required. Please log in.');
        return;
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

        const result = await response.json();
        console.log('Task updated successfully:', result);
        showSuccess(`Task ${taskId} updated successfully!`);

        // Redirect to tasks page after 2 seconds
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    } catch (error) {
        console.error('Error updating task:', error);
        showError(`Failed to update task: ${error.message}`);
    }
}

// Initialize the page
async function initializeEditTaskPage() {
    // Get task ID from URL
    const taskId = getTaskIdFromUrl();

    if (!taskId) {
        showError('No task ID provided. Redirecting to tasks page...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Check if Ralph is running and block if necessary
    await checkAndBlockIfRalphRunning();

    // Load projects for dropdown
    await loadProjects();

    // Load task data
    const task = await loadTaskData(taskId);
    if (task) {
        populateForm(task);
    } else {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Set up form submission handler
    const form = document.getElementById('editTaskForm');
    form.addEventListener('submit', handleSubmit);
}

// Load when page loads
if (document.getElementById('editTaskForm')) {
    initializeEditTaskPage();
}
