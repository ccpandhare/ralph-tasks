require('dotenv').config();
const puppeteer = require('puppeteer');

describe('Login Flow E2E Tests', () => {
  let browser;
  let page;
  const BASE_URL = process.env.TEST_URL || 'https://tasks.chinmaypandhare.uk';
  const TEST_PASSWORD = process.env.TEST_AUTH_PASSWORD;
  const INTEST_PASSWORD = 'wrongpassword123';

  beforeAll(async () => {
    // Launch browser in headless mode for CI/CD
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    // Clear sessionStorage before each test
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => sessionStorage.clear());
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should redirect unauthenticated users to login page when accessing index', async () => {
    // Try to access index.html without authentication
    const response = await page.goto(`${BASE_URL}/index.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Should redirect to login.html
    expect(page.url()).toContain('login.html');
    console.log('✓ Unauthenticated user redirected to login page');
  });

  test('should successfully login with correct password', async () => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Verify we're on the login page
    expect(page.url()).toContain('login.html');

    // Fill in the password field
    await page.waitForSelector('#password');
    await page.type('#password', TEST_PASSWORD);

    // Submit the form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);

    // Should redirect to index.html after successful login
    expect(page.url()).toContain('index.html');

    console.log('✓ Successful login with correct password');
  });

  test('should set sessionStorage after successful login', async () => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Fill in and submit the form
    await page.waitForSelector('#password');
    await page.type('#password', TEST_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);

    // Check sessionStorage
    const authenticated = await page.evaluate(() => {
      return sessionStorage.getItem('authenticated');
    });

    expect(authenticated).toBe('true');

    console.log('✓ SessionStorage set correctly after successful login');
  });

  test('should show error message for incorrect password', async () => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Fill in incorrect password
    await page.waitForSelector('#password');
    await page.type('#password', INTEST_PASSWORD);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    await page.waitForSelector('#errorMessage', { visible: true });

    // Get error message text
    const errorText = await page.$eval('#errorMessage', el => el.textContent);

    // Verify error message
    expect(errorText).toBeTruthy();
    expect(errorText).toContain('Incorrect password');

    // Should still be on login page
    expect(page.url()).toContain('login.html');

    console.log('✓ Error message displayed for incorrect password');
    console.log(`  - Error message: "${errorText}"`);
  });

  test('should clear password field after failed login', async () => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Fill in incorrect password
    await page.waitForSelector('#password');
    await page.type('#password', INTEST_PASSWORD);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait a moment for the form to process
    await page.waitForSelector('#errorMessage', { visible: true });

    // Check that password field is cleared
    const passwordValue = await page.$eval('#password', el => el.value);
    expect(passwordValue).toBe('');

    console.log('✓ Password field cleared after failed login attempt');
  });

  test('should logout successfully and clear session', async () => {
    // First, login
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

    // Verify we're logged in and on index.html
    expect(page.url()).toContain('index.html');

    // Wait for logout button to appear
    await page.waitForSelector('#logoutBtn');

    // Click logout button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#logoutBtn')
    ]);

    // Should redirect to login.html
    expect(page.url()).toContain('login.html');

    // Check sessionStorage is cleared
    const authenticated = await page.evaluate(() => {
      return sessionStorage.getItem('authenticated');
    });

    expect(authenticated).toBe('false');

    console.log('✓ Logout successful - redirected to login and session cleared');
  });

  test('should allow authenticated users to access protected pages', async () => {
    // First, login
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

    // Now try to access index.html directly
    await page.goto(`${BASE_URL}/index.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Should stay on index.html (not redirect to login)
    expect(page.url()).toContain('index.html');

    // Verify page content is visible (not redirected)
    const bodyContent = await page.evaluate(() => document.body.textContent);
    expect(bodyContent).toBeTruthy();

    console.log('✓ Authenticated user can access protected pages');
  });

  test('should maintain authentication across page navigation', async () => {
    // Login
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

    // Navigate to different pages
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0' });
    expect(page.url()).toContain('index.html');

    // SessionStorage should still be set
    let authenticated = await page.evaluate(() => {
      return sessionStorage.getItem('authenticated');
    });
    expect(authenticated).toBe('true');

    // Try navigating to create-task page (if it exists)
    await page.goto(`${BASE_URL}/create-task.html`, { waitUntil: 'networkidle0' });

    // SessionStorage should still be set
    authenticated = await page.evaluate(() => {
      return sessionStorage.getItem('authenticated');
    });
    expect(authenticated).toBe('true');

    console.log('✓ Authentication maintained across page navigation');
  });
});
