const puppeteer = require('puppeteer');

describe('Hello World E2E Test', () => {
  let browser;
  let page;
  const BASE_URL = process.env.TEST_URL || 'https://tasks.chinmaypandhare.uk';

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
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should load the webpage successfully with 200 status', async () => {
    // Navigate to the login page (which doesn't require auth)
    const response = await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Verify the page loads successfully
    expect(response).not.toBeNull();
    expect(response.status()).toBe(200);

    // Verify page has a title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);

    console.log(`✓ Page loaded successfully`);
    console.log(`  - URL: ${BASE_URL}/login.html`);
    console.log(`  - Status: ${response.status()}`);
    console.log(`  - Title: ${title}`);
  });

  test('should have proper HTML structure', async () => {
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Check for basic HTML elements
    const htmlElement = await page.$('html');
    expect(htmlElement).not.toBeNull();

    const bodyElement = await page.$('body');
    expect(bodyElement).not.toBeNull();

    const headElement = await page.$('head');
    expect(headElement).not.toBeNull();

    console.log('✓ HTML structure is valid');
  });

  test('should be accessible and render content', async () => {
    await page.goto(`${BASE_URL}/login.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for any content to be visible
    await page.waitForSelector('body', { visible: true });

    // Check that the body has some content
    const bodyContent = await page.evaluate(() => document.body.textContent);
    expect(bodyContent).toBeTruthy();
    expect(bodyContent.trim().length).toBeGreaterThan(0);

    console.log('✓ Page renders content successfully');
    console.log(`  - Content length: ${bodyContent.trim().length} characters`);
  });
});
