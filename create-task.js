// Create Task Form functionality
const API_URL = '/api/tasks';
const PROJECTS_API_URL = '/api/projects';

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

// Get next task ID from existing tasks
async function getNextTaskId() {
    const token = getAuthToken();
    if (!token) {
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
        const tasks = data.tasks;

        if (!tasks || tasks.length === 0) {
            return 'task-001';
        }

        // Find the highest task number
        let maxNumber = 0;
        tasks.forEach(task => {
            const match = task.id.match(/^task-(\d+)$/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        });

        // Return next task ID
        const nextNumber = maxNumber + 1;
        return `task-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error fetching tasks for ID generation:', error);
        return null;
    }
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

// Reset form
function resetForm() {
    document.getElementById('createTaskForm').reset();

    // Reset requirements to just one field
    const requirementsList = document.getElementById('requirementsList');
    requirementsList.innerHTML = `
        <div class="requirement-item">
            <input type="text" class="requirement-input" placeholder="Enter requirement" required>
            <button type="button" class="btn btn-remove" onclick="removeRequirement(this)">Remove</button>
        </div>
    `;

    hideError();
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();

    hideError();

    // Validate form
    if (!validateForm()) {
        return;
    }

    // Get form data
    const project = document.getElementById('project').value.trim();
    const title = document.getElementById('title').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const requirements = collectRequirements();

    // Generate task ID
    const taskId = await getNextTaskId();
    if (!taskId) {
        showError('Failed to generate task ID. Please try again.');
        return;
    }

    // Create task object
    const newTask = {
        id: taskId,
        project: project,
        title: title,
        requirements: requirements,
        status: false,
        completed: false,
        created: getCurrentDate(),
        notes: notes
    };

    // Submit to API (this will be implemented in task-008)
    // For now, we'll just show a message that the frontend is ready
    console.log('New task to be created:', newTask);
    showSuccess(`Task ${taskId} created successfully! (Note: Backend endpoint not yet implemented)`);

    // Reset form after successful creation
    setTimeout(() => {
        resetForm();
    }, 1000);
}

// Initialize the page
function initializeCreateTaskPage() {
    // Load projects for dropdown
    loadProjects();

    // Set up form submission handler
    const form = document.getElementById('createTaskForm');
    form.addEventListener('submit', handleSubmit);
}

// Load when page loads
if (document.getElementById('createTaskForm')) {
    initializeCreateTaskPage();
}
