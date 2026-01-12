# Task Manager Web Application

A simple task management web application with password authentication and backend API.

## Features

- Password-protected access with SHA-256 hashing
- Backend API to read tasks from /var/main/tasks.json
- Responsive design with custom CSS
- Session-based authentication

## Setup

### Prerequisites

- Node.js installed on the system

### Running the Backend

Start the API server:

```bash
npm start
```

The server will run on port 3001 by default (configurable via PORT environment variable).

## API Endpoints

### GET /api/tasks

Retrieves all tasks from /var/main/tasks.json

**Authentication:** Required (Bearer token)

**Request Headers:**
```
Authorization: Bearer <password_hash>
```

**Response:**
```json
{
  "version": "1.0",
  "tasks": [...]
}
```

## Authentication

- Default password: `admin123`
- Password hash: `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9`
- Frontend uses sessionStorage for authentication state
- Backend uses Bearer token authentication with password hash

## Testing

### Running Tests

This project includes end-to-end tests using Puppeteer and Jest.

**Run all tests:**
```bash
npm test
```

**Run only e2e tests:**
```bash
npm run test:e2e
```

**Run tests with custom URL:**
```bash
TEST_URL=https://your-domain.com npm test
```

### Test Configuration

- Tests run in headless mode by default (suitable for CI/CD)
- Default timeout: 30 seconds per test
- Test environment: Node.js
- Tests are located in `tests/e2e/` directory

### Writing Tests

E2E tests use Puppeteer to automate browser interactions. Example structure:

```javascript
describe('Test Suite', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should do something', async () => {
    page = await browser.newPage();
    await page.goto('https://example.com');
    // Your test assertions here
  });
});
```

## Project Structure

- `index.html` - Main application page
- `login.html` - Login page
- `auth.js` - Authentication logic (frontend)
- `style.css` - Custom styles
- `server.js` - Backend API server
- `package.json` - Node.js project configuration
- `tests/e2e/` - End-to-end tests using Puppeteer
