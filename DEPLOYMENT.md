# Face Recognition Attendance System - Deployment Guide

## Prerequisites
- Node.js 14.x or higher
- npm 6.x or higher
- SQLite3 support

## Installation & Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env` file with your settings:
```
PORT=3000
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=admin123
```

### 3. Start the Server
```bash
npm start
```

Server will run at `http://localhost:3000`

## Database
- SQLite database stored in `data/attendance.db`
- Created automatically on first run
- Tables: `users`, `attendance`

## Features
- **Face Registration**: Users register and enroll their face
- **Face Recognition**: Mark attendance using live camera
- **Teacher Dashboard**: View class-wide statistics
- **Admin Dashboard**: System-wide metrics and activity logs

## API Endpoints
- `POST /api/signup` - User registration
- `POST /api/save-face` - Face enrollment
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance?username=X` - View history
- `POST /api/admin-login` - Admin authentication
- `GET /api/admin/stats` - Admin dashboard stats
- `POST /api/user-login` - Teacher authentication
- `GET /api/user/stats` - Teacher/student dashboard

## Credentials
**Default Admin:**
- Username: `admin`
- Password: `admin123`

## Troubleshooting

### Port Already in Use
```bash
# Windows - Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Face Recognition Not Working
1. Check browser permissions for camera access
2. Ensure network access to CDN for `face-api.js` models
3. Clear browser cache and reload

### Database Issues
- Delete `data/attendance.db` to reset
- Database recreates automatically

## Security Notes
- Change default admin credentials in production
- Use HTTPS in production environments
- Store `.env` file securely (not in version control)
- Face descriptors are 128-dimensional vectors (not actual photos)

## Performance
- Lightweight face detection using TinyFaceDetector
- SQLite suitable for ~1000+ concurrent users
- Consider PostgreSQL for larger deployments

## Deployment Platforms
- Heroku: `heroku create` then `git push heroku main`
- AWS EC2: Install Node.js, clone repo, run `npm install && npm start`
- DigitalOcean: Similar to EC2 setup
- Docker: See Dockerfile setup (optional)

## Logs
Monitor server logs for errors:
```bash
npm start > app.log 2>&1 &
tail -f app.log
```
