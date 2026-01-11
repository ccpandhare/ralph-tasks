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
   - Endpoints: GET /api/tasks, GET /api/projects, POST /api/tasks, PUT /api/tasks/:taskId

3. **Deployment**
   - Nginx reverse proxy on tasks.chinmaypandhare.uk
   - Systemd service: `tasks-api.service`
   - SSL/TLS via Let's Encrypt

## Authentication

- Password: `4wJkq5b6fmtuG3Nv1lHxJXYenULuE/j7dW1SksImqZ8=`
- SHA-256 Hash: `e2b4e38fed003ce3e1aceb2d2cff3c606ab8bf13a970e0e02e71b372cf4bd0f6`
- Auth method: Bearer token with password hash
- Session storage: Browser sessionStorage (persists within session only)

## Important Configuration

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
4. Verify API is accessible: `curl -k -H "Authorization: Bearer e2b4e38fed003ce3e1aceb2d2cff3c606ab8bf13a970e0e02e71b372cf4bd0f6" https://tasks.chinmaypandhare.uk/api/tasks`

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
1. Verify PASSWORD_HASH in `auth.js` matches PASSWORD_HASH in `server.js`
2. Use the correct Bearer token: `e2b4e38fed003ce3e1aceb2d2cff3c606ab8bf13a970e0e02e71b372cf4bd0f6`
3. Check browser console for authentication issues

## Testing

**Test API directly:**
```bash
curl -s -H "Authorization: Bearer e2b4e38fed003ce3e1aceb2d2cff3c606ab8bf13a970e0e02e71b372cf4bd0f6" \
  http://localhost:3001/api/tasks | jq .
```

**Test API through nginx:**
```bash
curl -k -s -H "Authorization: Bearer e2b4e38fed003ce3e1aceb2d2cff3c606ab8bf13a970e0e02e71b372cf4bd0f6" \
  https://tasks.chinmaypandhare.uk/api/tasks | jq .
```

**Check nginx logs:**
```bash
tail -f /var/log/nginx/tasks.chinmaypandhare.uk.access.log
tail -f /var/log/nginx/tasks.chinmaypandhare.uk.error.log
```

## Deployment Workflow

1. Make code changes in `/var/www/tasks.chinmaypandhare.uk`
2. Test locally (ensure server is running)
3. Restart systemd service if backend changed: `systemctl restart tasks-api.service`
4. Reload nginx if config changed: `systemctl reload nginx`
5. Verify in browser at https://tasks.chinmaypandhare.uk

## File Paths

- Tasks data: `/var/main/tasks.json`
- Projects config: `/var/main/projects.json`
- Application root: `/var/www/tasks.chinmaypandhare.uk`
- Nginx config: `/etc/nginx/sites-available/tasks.chinmaypandhare.uk`
- Systemd service: `/etc/systemd/system/tasks-api.service`
