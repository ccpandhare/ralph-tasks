# Task Manager Web Application - Agent Notes

## Architecture Overview

This is a task management web application that displays and manages tasks from `/var/main/tasks.json`.

### Components

1. **Frontend** (Static HTML/CSS/JS)
   - `index.html` - Main task list page
   - `login.html` - Authentication page
   - `create-task.html` - Task creation form
   - `auth.js` - Authentication logic
   - `tasks.js` - Task display and management
   - `create-task.js` - Task creation logic
   - `style.css` - Styling

2. **Backend** (Node.js HTTP Server)
   - `server.js` - API server on port 3001
   - Endpoints:
     - GET /api/tasks - List all tasks
     - GET /api/projects - List all projects
     - POST /api/tasks - Create new task
     - PUT /api/tasks/:taskId - Update task
     - POST /api/ralph/execute - Trigger Ralph execution
     - GET /api/ralph/status - Check Ralph execution status

3. **Deployment**
   - Nginx reverse proxy on tasks.chinmaypandhare.uk
   - Systemd service: `tasks-api.service`
   - SSL/TLS via Let's Encrypt

## Authentication

- Password: Stored in `.env` file (not committed to version control)
- Password variable: `AUTH_PASSWORD` in `.env`
- SHA-256 Hash variable: `AUTH_PASSWORD_HASH` in `.env`
- Auth method: Bearer token with password hash
- Session storage: Browser sessionStorage (persists within session only)
- Security: Password and hash are stored in `.env` file which is excluded from git via `.gitignore`

## Important Configuration

### File Permissions and Ownership

The Node.js backend runs as the `www-data` user (configured in systemd service). File permissions must be configured to allow proper read/write access:

**Production Data (Read-Write for www-data):**
- `/var/main/tasks.json` - Must be writable by `www-data` for task CRUD operations
- `/var/main/projects.json` - Must be readable by `www-data` (currently read-only is acceptable)
- `/var/main/` directory - Must allow `www-data` to create `.tmp` files for atomic writes

**Test Data (Read-Write for www-data):**
- `/var/www/tasks.chinmaypandhare.uk/test-tasks.json` - Must be writable by `www-data`
- `/var/www/tasks.chinmaypandhare.uk/test-projects.json` - Must be writable by `www-data`
- Application directory - Must allow `www-data` to create `.tmp` files for atomic writes

**Required Permissions Summary:**
```bash
# Application directory - must allow www-data to create .tmp files
drwxrwxr-x root www-data /var/www/tasks.chinmaypandhare.uk

# Test data files - must be writable by www-data
-rw-rw-r-- www-data www-data test-tasks.json
-rw-rw-r-- www-data www-data test-projects.json

# Production directory - must allow www-data to create .tmp files
drwxrwxr-x root www-data /var/main

# Production data files - must be writable by www-data
-rw-rw-r-- root www-data /var/main/tasks.json
-rw-rw-r-- root www-data /var/main/projects.json
```

**Note:** The server uses atomic writes (write to `.tmp` file, then rename) which requires write permission to both the directory and the files.

**Ralph Execution Logs Directory:**
```bash
# Ralph logs directory - must be writable by www-data
drwxr-xr-x www-data www-data /var/main/logs/ralph-runs
```

If the directory doesn't exist, create it with:
```bash
mkdir -p /var/main/logs/ralph-runs
chown www-data:www-data /var/main/logs/ralph-runs
chmod 755 /var/main/logs/ralph-runs
```

Without proper permissions, Ralph execution will fail with "EACCES: permission denied" error when trying to create log files.

### Nginx Proxy Setup

The nginx configuration MUST include the `/api/` proxy pass to the Node.js backend:

```nginx
location /api/ {
    proxy_pass http://localhost:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

Without this proxy configuration, API calls from the frontend will fail with 404 errors.

### Systemd Service

The Node.js backend runs as a systemd service:
- Service name: `tasks-api.service`
- Location: `/etc/systemd/system/tasks-api.service`
- User: `www-data`
- Port: 3001
- Auto-start: Enabled
- Auto-restart: Yes (RestartSec=10)

**Managing the service:**
```bash
systemctl status tasks-api.service    # Check status
systemctl restart tasks-api.service   # Restart service
systemctl logs -u tasks-api.service   # View logs
```

## Common Issues and Solutions

### Issue: Empty task display or "No tasks found"

**Symptoms:** Tasks don't show up on the frontend, but API returns data when tested with curl.

**Cause:** Missing nginx proxy configuration for `/api/` endpoint.

**Solution:**
1. Verify nginx has the proxy_pass configuration (see above)
2. Test nginx config: `nginx -t`
3. Reload nginx: `systemctl reload nginx`
4. Verify API is accessible:
```bash
AUTH_HASH=$(grep AUTH_PASSWORD_HASH .env | cut -d '=' -f2)
curl -k -H "Authorization: Bearer $AUTH_HASH" https://tasks.chinmaypandhare.uk/api/tasks
```

### Issue: Backend not running

**Symptoms:** API returns connection refused errors.

**Cause:** Systemd service not running or crashed.

**Solution:**
1. Check service status: `systemctl status tasks-api.service`
2. Check if port 3001 is listening: `ss -tulpn | grep :3001`
3. Restart service: `systemctl restart tasks-api.service`
4. Check logs: `journalctl -u tasks-api.service -n 50`

### Issue: Authentication failures

**Symptoms:** API returns "Unauthorized" errors.

**Cause:** Incorrect Bearer token or password hash mismatch between frontend and backend.

**Solution:**
1. Verify PASSWORD_HASH in `auth.js` matches AUTH_PASSWORD_HASH in `.env`
2. Check that the `.env` file is properly loaded by `server.js`
3. Check browser console for authentication issues

## Testing

### API Testing

**Test API directly:**
```bash
# Get the password hash from .env
AUTH_HASH=$(grep AUTH_PASSWORD_HASH .env | cut -d '=' -f2)

# Test the API
curl -s -H "Authorization: Bearer $AUTH_HASH" \
  http://localhost:3001/api/tasks | jq .
```

**Test API through nginx:**
```bash
# Get the password hash from .env
AUTH_HASH=$(grep AUTH_PASSWORD_HASH .env | cut -d '=' -f2)

# Test through nginx
curl -k -s -H "Authorization: Bearer $AUTH_HASH" \
  https://tasks.chinmaypandhare.uk/api/tasks | jq .
```

**Check nginx logs:**
```bash
tail -f /var/log/nginx/tasks.chinmaypandhare.uk.access.log
tail -f /var/log/nginx/tasks.chinmaypandhare.uk.error.log
```

### End-to-End Testing

**Framework:** Puppeteer + Jest

**Run tests:**
```bash
npm test              # Run all tests
npm run test:e2e      # Run only e2e tests
```

**Test Files:**
- `tests/e2e/login.test.js` - Authentication flow (8 tests)
- `tests/e2e/tasks-crud.test.js` - Task CRUD operations (8 tests)
- `tests/e2e/logs.test.js` - Logs viewer functionality (10 tests)

**Test Account:**
- Uses `TEST_AUTH_PASSWORD` and `TEST_AUTH_PASSWORD_HASH` from `.env`
- Runs against **in-memory mock data** (does not modify `/var/main/tasks.json`)
- Isolated from production data for safe testing

**Coverage:**
- Login/logout flows with authentication
- Task creation, reading, updating (mark complete)
- Task filtering (open/completed views)
- Form validation
- Logs viewer with filtering and auto-refresh
- Mobile/tablet responsiveness

## Deployment Workflow

1. Make code changes in `/var/www/tasks.chinmaypandhare.uk`
2. Test locally (ensure server is running)
3. Restart systemd service if backend changed: `sudo systemctl restart tasks-api.service`
4. Reload nginx if config changed: `sudo systemctl reload nginx`
5. Run e2e tests: `npm run test:e2e` (optional - can skip if just ran)
6. Commit changes:
   ```bash
   git add <files>
   git commit -m "commit message"
   ```
7. Push to GitHub: `git push origin master`
8. Verify deployment at https://tasks.chinmaypandhare.uk

**GitHub Repository:** `ccpandhare/ralph-tasks`

**Note:** The application is deployed directly from `/var/www/tasks.chinmaypandhare.uk`. Changes are live immediately after server restart. Git push is for version control and backup.

## Ralph Execution

The task management app includes Ralph execution capability:

- **Trigger Ralph:** Click "Run Ralph" button on main page
- **Status Tracking:** Button disables during execution and shows "Ralph Running..."
- **Auto-Refresh:** Task list refreshes automatically when Ralph completes
- **Safety:** Prevents concurrent executions (returns 409 if already running)
- **Authentication:** Requires Bearer token authentication
- **Polling:** Status checked every 3 seconds during execution
- **Backend:** Uses child_process.spawn to run `/var/main/scripts/ralph-once.sh`

**Testing Ralph execution:**
```bash
# Get the password hash from .env
AUTH_HASH=$(grep AUTH_PASSWORD_HASH .env | cut -d '=' -f2)

# Check status
curl -H "Authorization: Bearer $AUTH_HASH" \
  http://localhost:3001/api/ralph/status

# Trigger execution
curl -X POST -H "Authorization: Bearer $AUTH_HASH" \
  http://localhost:3001/api/ralph/execute
```

## File Paths

- Tasks data: `/var/main/tasks.json`
- Projects config: `/var/main/projects.json`
- Application root: `/var/www/tasks.chinmaypandhare.uk`
- Nginx config: `/etc/nginx/sites-available/tasks.chinmaypandhare.uk`
- Systemd service: `/etc/systemd/system/tasks-api.service`
- Ralph script: `/var/main/scripts/ralph-once.sh`
- E2E tests: `/var/www/tasks.chinmaypandhare.uk/tests/e2e/`
