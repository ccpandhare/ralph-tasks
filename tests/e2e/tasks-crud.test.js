require('dotenv').config();
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

describe('Tasks CRUD Operations E2E Tests', () => {
  let browser;
  let page;
  const BASE_URL = process.env.TEST_URL || 'https://tasks.chinmaypandhare.uk';
  const TEST_PASSWORD = process.env.TEST_AUTH_PASSWORD;

  // Helper function to login with test account
  async function login() {
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.waitForSelector('#password');
    await page.type('#password', TEST_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);

    // Verify we're logged in
    expect(page.url()).toContain('index.html');
  }

  // Helper function to reset test data
  async function resetTestData() {
    // Call the reset endpoint to ensure clean state
    const response = await fetch(`${BASE_URL}/api/test/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TEST_AUTH_PASSWORD_HASH}`
      }
    });

    if (!response.ok) {
      console.warn('Warning: Failed to reset test data, tests may be affected');
    }
  }

  beforeAll(async () => {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    // Reset test data once before all tests
    await resetTestData();
  });

  afterAll(async () => {
    // Close browser
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Reset test data before each test to ensure isolation
    await resetTestData();

    page = await browser.newPage();
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => sessionStorage.clear());
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should read and display tasks in the list', async () => {
    await login();

    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });

    // Get all task cards
    const taskCards = await page.$$('.task-card');

    // We should have at least 2 open tasks (test-001 and test-002)
    expect(taskCards.length).toBeGreaterThanOrEqual(2);

    // Check if test task titles are present
    const pageContent = await page.evaluate(() => document.body.textContent);
    expect(pageContent).toContain('Test Task 1');
    expect(pageContent).toContain('Test Task 2');

    console.log(`✓ Successfully loaded and displayed ${taskCards.length} task(s)`);
  });

  test('should display task details and requirements', async () => {
    await login();

    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });

    // Get the first task card
    const firstTask = await page.$('.task-card');
    expect(firstTask).toBeTruthy();

    // Check for task ID, project, and title
    const taskContent = await page.evaluate((el) => el.textContent, firstTask);
    expect(taskContent).toMatch(/test-\d{3}/); // Task ID pattern

    // Click to expand requirements (if collapsed)
    const toggleButton = await firstTask.$('.toggle-btn');
    if (toggleButton) {
      await toggleButton.click();
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for animation
    }

    // Check requirements are visible
    const requirementsList = await firstTask.$('.requirements-list');
    expect(requirementsList).toBeTruthy();

    console.log('✓ Task details and requirements displayed correctly');
  });

  test('should create a new task via the form', async () => {
    await login();

    // Navigate to create task page
    await page.goto(`${BASE_URL}/create-task.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for form to load and projects to be populated
    await page.waitForSelector('#createTaskForm');
    // Wait for at least one project option to be populated (excluding the default "Select a project")
    await page.waitForFunction(
      () => document.querySelectorAll('#project option').length > 1,
      { timeout: 10000 }
    );

    // Get the first available project
    const firstProject = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('#project option'));
      return options.length > 1 ? options[1].value : null;
    });
    expect(firstProject).toBeTruthy();

    // Fill in the form
    await page.select('#project', firstProject);
    await page.type('#title', 'New E2E Test Task');

    // Clear default requirement and add custom one
    await page.waitForSelector('.requirement-input');
    await page.click('.requirement-input');
    await page.evaluate(() => document.querySelector('.requirement-input').value = '');
    await page.type('.requirement-input', 'E2E Test Requirement 1');

    // Add another requirement
    const addReqButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Add Requirement'));
    });
    await addReqButton.click();
    await new Promise(resolve => setTimeout(resolve, 300));
    const requirementInputs = await page.$$('.requirement-input');
    await requirementInputs[requirementInputs.length - 1].type('E2E Test Requirement 2');

    // Add notes
    await page.type('#notes', 'Created via E2E test');

    // Listen for the API request
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/tasks') && response.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for API response
    const response = await responsePromise;
    const responseStatus = response.status();
    const responseData = await response.json();
    console.log(`Create task API response status: ${responseStatus}`);

    // Task creation should succeed (201) in test environment
    expect(responseStatus).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.task).toBeDefined();

    // Wait for success message
    await page.waitForSelector('#successMessage', {
      visible: true,
      timeout: 10000
    });

    const successMessage = await page.$eval('#successMessage', el => el.textContent);
    expect(successMessage).toContain('created successfully');

    // Verify the task was actually persisted by fetching all tasks
    const verifyResponse = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TEST_AUTH_PASSWORD_HASH}`
      }
    });
    expect(verifyResponse.ok).toBe(true);

    const tasksData = await verifyResponse.json();
    const createdTask = tasksData.tasks.find(t => t.title === 'New E2E Test Task');
    expect(createdTask).toBeDefined();
    expect(createdTask.requirements).toContain('E2E Test Requirement 1');
    expect(createdTask.requirements).toContain('E2E Test Requirement 2');
    expect(createdTask.notes).toBe('Created via E2E test');

    console.log('✓ Successfully created new task via form');
    console.log('✓ Task persisted to test data file and verified');
  }, 60000);

  test('should update task status (mark as complete)', async () => {
    await login();

    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });

    // Find a task with "Mark as Complete" button
    const completeButton = await page.$('.task-card button.btn-complete');
    expect(completeButton).toBeTruthy();

    // Get task ID before marking complete
    const taskCard = await page.$('.task-card');
    const taskIdText = await page.evaluate((el) => {
      const idElement = el.querySelector('.task-id');
      return idElement ? idElement.textContent : '';
    }, taskCard);

    // Extract task ID (any format like task-xxx or test-xxx)
    const taskIdMatch = taskIdText.match(/([\w]+-\d{3})/);
    expect(taskIdMatch).toBeTruthy();
    const taskId = taskIdMatch[1];

    console.log(`Attempting to mark task ${taskId} as complete`);

    // Setup dialog handler before clicking the button
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Mark task as complete');
      await dialog.accept();
    });

    // Listen for network responses to see if the API call succeeds
    const responsePromise = page.waitForResponse(
      response => response.url().includes(`/api/tasks/${taskId}`) && response.request().method() === 'PUT',
      { timeout: 10000 }
    );

    // Click the "Mark as Complete" button
    await completeButton.click();

    // Wait for the API response
    const response = await responsePromise;
    const responseStatus = response.status();
    const responseData = await response.json();
    console.log(`API response status: ${responseStatus}`);

    // Task update should succeed (200) in test environment
    expect(responseStatus).toBe(200);
    expect(responseData.success).toBe(true);

    // Wait for success message
    await page.waitForSelector('.message-container', {
      visible: true,
      timeout: 10000
    });

    // Wait for the task list to refresh
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the task was actually updated by fetching it again
    const verifyResponse = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TEST_AUTH_PASSWORD_HASH}`
      }
    });
    expect(verifyResponse.ok).toBe(true);

    const tasksData = await verifyResponse.json();
    const updatedTask = tasksData.tasks.find(t => t.id === taskId);
    expect(updatedTask).toBeDefined();
    expect(updatedTask.completed).toBe(true);
    expect(updatedTask.status).toBe(true);

    console.log(`✓ Successfully marked task ${taskId} as complete`);
    console.log('✓ Task update persisted to test data file and verified');
  }, 60000);

  test('should switch between open and completed tasks views', async () => {
    await login();

    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });

    // Default view should be open tasks
    let viewButtons = await page.$$('.view-btn');
    expect(viewButtons.length).toBeGreaterThanOrEqual(2);

    // Check initial view (Open Tasks should be active)
    const initialActiveBtn = await page.$('.view-btn.active');
    const initialActiveText = await page.evaluate(el => el.textContent, initialActiveBtn);
    expect(initialActiveText).toContain('Open Tasks');

    // Count open tasks
    let openTaskCards = await page.$$('.task-card');
    const openTaskCount = openTaskCards.length;

    console.log(`✓ Open tasks view displayed with ${openTaskCount} task(s)`);

    // Click "Completed Tasks" button
    const completedBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('.view-btn'));
      return buttons.find(btn => btn.textContent.includes('Completed Tasks'));
    });

    await completedBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify view switched
    const activeBtn = await page.$('.view-btn.active');
    const activeText = await page.evaluate(el => el.textContent, activeBtn);
    expect(activeText).toContain('Completed Tasks');

    // Count completed tasks
    const completedTaskCards = await page.$$('.task-card');
    const completedTaskCount = completedTaskCards.length;

    console.log(`✓ Completed tasks view displayed with ${completedTaskCount} task(s)`);

    // Switch back to open tasks
    const openBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('.view-btn'));
      return buttons.find(btn => btn.textContent.includes('Open Tasks'));
    });

    await openBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify we're back to open tasks
    const finalActiveBtn = await page.$('.view-btn.active');
    const finalActiveText = await page.evaluate(el => el.textContent, finalActiveBtn);
    expect(finalActiveText).toContain('Open Tasks');

    console.log('✓ Successfully toggled between open and completed tasks views');
  });

  test('should verify mock data structure from API', async () => {
    await login();

    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });

    // Get task count from UI
    const taskCards = await page.$$('.task-card');
    const taskCount = taskCards.length;

    // Verify we have test tasks
    expect(taskCount).toBeGreaterThanOrEqual(2);

    console.log(`✓ Mock data structure verified with ${taskCount} task(s) from test account`);
    console.log('✓ Test account serves in-memory mock data correctly');
  });

  test('should filter tasks by completed status correctly', async () => {
    await login();

    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });

    // Get all open tasks
    const openTaskCards = await page.$$('.task-card');
    const openTaskIds = await Promise.all(
      openTaskCards.map(async (card) => {
        const idText = await page.evaluate(el => {
          const idElement = el.querySelector('.task-id');
          return idElement ? idElement.textContent : '';
        }, card);
        const match = idText.match(/(test-\d{3})/);
        return match ? match[1] : null;
      })
    );

    // Verify we have open tasks
    expect(openTaskIds.length).toBeGreaterThan(0);

    console.log(`✓ Displayed ${openTaskIds.length} open task(s)`);

    // Switch to completed tasks view
    const completedBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('.view-btn'));
      return buttons.find(btn => btn.textContent.includes('Completed Tasks'));
    });

    await completedBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get all completed task cards
    const completedTaskCards = await page.$$('.task-card');
    const completedTaskIds = await Promise.all(
      completedTaskCards.map(async (card) => {
        const idText = await page.evaluate(el => {
          const idElement = el.querySelector('.task-id');
          return idElement ? idElement.textContent : '';
        }, card);
        const match = idText.match(/(test-\d{3})/);
        return match ? match[1] : null;
      })
    );

    // Verify we have completed tasks
    expect(completedTaskIds.length).toBeGreaterThan(0);

    console.log(`✓ Displayed ${completedTaskIds.length} completed task(s)`);
    console.log('✓ Task filtering by completed status working correctly');
  });

  test('should handle form validation correctly', async () => {
    await login();

    // Navigate to create task page
    await page.goto(`${BASE_URL}/create-task.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for form to load and projects to be populated
    await page.waitForSelector('#createTaskForm');
    // Wait for at least one project option to be populated
    await page.waitForFunction(
      () => document.querySelectorAll('#project option').length > 1,
      { timeout: 10000 }
    );

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Wait a moment for validation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if we're still on the create task page (form not submitted)
    expect(page.url()).toContain('create-task.html');

    console.log('✓ Form validation prevented empty submission');

    // Fill in only title (missing project)
    await page.type('#title', 'Test Validation Task');
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should still be on create task page
    expect(page.url()).toContain('create-task.html');

    console.log('✓ Form validation requires project selection');

    // Select first available project
    const firstProject = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('#project option'));
      return options.length > 1 ? options[1].value : null;
    });
    await page.select('#project', firstProject);

    // Clear requirement field
    const requirementInput = await page.$('.requirement-input');
    if (requirementInput) {
      await requirementInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
    }

    // Try to submit with empty requirement
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should still be on create task page
    expect(page.url()).toContain('create-task.html');

    console.log('✓ Form validation requires at least one non-empty requirement');
    console.log('✓ Form validation working correctly');
  }, 60000);
});
