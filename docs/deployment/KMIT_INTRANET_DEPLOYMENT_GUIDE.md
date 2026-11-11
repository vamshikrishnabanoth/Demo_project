# 🏫 KMIT Intranet Deployment Guide

## Your Existing Setup (Confirmed)

**Working KMIT Websites:**
- `http://10.11.1.19/` 
- `http://10.11.52.100/`

**Your Quiz Site Will Be:**
- `http://10.11.x.x:3000/` (Frontend)
- `http://10.11.x.x:5000/` (Backend API)

Or single domain:
- `http://10.11.x.x/` (with Nginx proxy)

---

## Deployment Architecture

```
KMIT Network (10.11.x.x)
│
├── Web Server (10.11.x.x)
│   ├── Nginx (Port 80) - Reverse Proxy
│   │   ├── / → Frontend (Port 3000)
│   │   └── /api → Backend (Port 5000)
│   │
│   ├── Frontend (React - Port 3000)
│   │   └── Build files (HTML, JS, CSS)
│   │
│   ├── Backend (Node.js - Port 5000)
│   │   ├── Express Server
│   │   ├── Socket.io (WebSockets)
│   │   └── API Routes
│   │
│   └── Database (PostgreSQL - Port 5432)
│       └── Quiz data
│
└── Optional: AI Model Server (Port 5001)
    └── Python/Flask (if running locally)
```

---

## Step-by-Step Deployment

### Phase 1: Get Server Access from KMIT IT Team

**What to Request:**
1. **Server allocation** with specs:
   - Ubuntu 20.04+ or Windows Server
   - 4 GB RAM minimum (8 GB recommended)
   - 50 GB storage
   - Static IP in 10.11.x.x range

2. **Ports to open:**
   - Port 80 (HTTP)
   - Port 443 (HTTPS - optional)
   - Port 3000 (Frontend - temporary)
   - Port 5000 (Backend - temporary)
   - Port 5432 (PostgreSQL - internal only)

3. **Domain/DNS** (optional):
   - `quiz.kmit.local` or `kmit-quiz.local`
   - Points to assigned IP

**What IT Team Gives You:**
```
IP Address: 10.11.x.x
SSH Access: username@10.11.x.x
Sudo privileges: Yes/No
```

---

### Phase 2: Server Setup (One-time)

#### A. Install Required Software

**On Linux Server:**
```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 4. Install Nginx (web server)
sudo apt install -y nginx

# 5. Install PM2 (process manager)
sudo npm install -g pm2

# 6. Install Git
sudo apt install -y git

# Verify installations
node --version  # Should show v18.x.x
npm --version   # Should show v9.x.x
psql --version  # Should show PostgreSQL version
nginx -v        # Should show nginx version
```

#### B. Setup PostgreSQL Database

```bash
# 1. Switch to postgres user
sudo -u postgres psql

# 2. Create database and user
CREATE DATABASE kmit_quiz;
CREATE USER quiz_admin WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE kmit_quiz TO quiz_admin;
\q

# 3. Enable remote connections (if needed)
sudo nano /etc/postgresql/14/main/postgresql.conf
# Change: listen_addresses = 'localhost' to '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add: host all all 10.11.0.0/16 md5

sudo systemctl restart postgresql
```

---

### Phase 3: Deploy Application

#### A. Transfer Code to Server

**Option 1: Git Clone (Recommended)**
```bash
# On server
cd /var/www
sudo mkdir kmit-quiz
sudo chown $USER:$USER kmit-quiz
cd kmit-quiz

# Clone your repository
git clone https://github.com/your-repo/Demo_project.git .

# Or use Git from college network
git clone file:///path/to/local/repo .
```

**Option 2: Manual Transfer**
```bash
# On your local machine
# Zip the project
tar -czf quiz-app.tar.gz Demo_project/

# Transfer via SCP
scp quiz-app.tar.gz username@10.11.x.x:/var/www/

# On server
cd /var/www
tar -xzf quiz-app.tar.gz
mv Demo_project kmit-quiz
```

#### B. Configure Environment Variables

**Backend (.env):**
```bash
cd /var/www/kmit-quiz/server
nano .env
```

```env
# Database
DATABASE_URL="postgresql://quiz_admin:your_secure_password@localhost:5432/kmit_quiz"

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET="your-generated-secret-here"

# Server Config
NODE_ENV=production
PORT=5000

# AI Model (Choose one option)

# Option 1: Local AI Model (Slow)
AI_MODEL_URL=http://localhost:5001/generate

# Option 2: Cloud AI Model (Fast - Recommended)
AI_MODEL_URL=https://api-inference.huggingface.co/models/your-model
HUGGINGFACE_API_KEY=your_api_key_here

# Or Replicate
REPLICATE_API_TOKEN=your_replicate_token_here

# CORS (Allow frontend)
CLIENT_URL=http://10.11.x.x
```

**Frontend (.env.production):**
```bash
cd /var/www/kmit-quiz/client
nano .env.production
```

```env
# API Endpoint (Backend)
VITE_API_URL=http://10.11.x.x:5000

# WebSocket URL (for live quiz)
VITE_WS_URL=http://10.11.x.x:5000

# App Config
VITE_APP_NAME=KMIT Quiz Platform
```

#### C. Install Dependencies & Build

**Backend:**
```bash
cd /var/www/kmit-quiz/server
npm install --production
npx prisma generate
npx prisma migrate deploy
```

**Frontend:**
```bash
cd /var/www/kmit-quiz/client
npm install
npm run build
# Build creates 'dist' folder with static files
```

#### D. Seed Initial Data

```bash
cd /var/www/kmit-quiz/server

# 1. Create system accounts (admin, teachers)
node seed_system.js

# 2. Update second-year students
node update_second_year_field.js

# 3. Import first-year students (if CSV ready)
node import_first_year_from_csv.js

# Verify
node verify_students.js
```

---

### Phase 4: Configure Nginx (Reverse Proxy)

This makes your site accessible at `http://10.11.x.x/` instead of `http://10.11.x.x:3000/`

```bash
sudo nano /etc/nginx/sites-available/kmit-quiz
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name 10.11.x.x quiz.kmit.local;

    # Frontend (React build)
    location / {
        root /var/www/kmit-quiz/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support for Socket.io
    location /socket.io {
        proxy_pass http://localhost:5000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable site:**
```bash
# Link to sites-enabled
sudo ln -s /etc/nginx/sites-available/kmit-quiz /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

### Phase 5: Start Application with PM2

**Start Backend:**
```bash
cd /var/www/kmit-quiz/server
pm2 start server.js --name kmit-quiz-backend
pm2 save
pm2 startup
```

**PM2 Commands:**
```bash
# View logs
pm2 logs kmit-quiz-backend

# Restart app
pm2 restart kmit-quiz-backend

# Stop app
pm2 stop kmit-quiz-backend

# Monitor
pm2 monit

# List all apps
pm2 list
```

---

### Phase 6: Testing

#### A. From Your Machine (on KMIT WiFi)

1. **Test Backend API:**
   ```bash
   curl http://10.11.x.x/api/health
   # Should return: {"status": "ok"}
   ```

2. **Open Browser:**
   ```
   http://10.11.x.x/
   ```

3. **Test Login:**
   - Username: `admin`
   - Password: `KMIT@1234`

4. **Test Student Login:**
   - Username: `25BD1A0501`
   - Password: `25BD1A0501`

#### B. Test from Different Locations

- Computer Lab 1
- Computer Lab 2
- Library WiFi
- Different floors
- Mobile on KMIT WiFi

---

## Updates & Maintenance

### A. Code Updates

```bash
# On server
cd /var/www/kmit-quiz

# Pull latest code
git pull origin main

# Update backend
cd server
npm install
npx prisma migrate deploy
pm2 restart kmit-quiz-backend

# Update frontend
cd ../client
npm install
npm run build
# Nginx automatically serves new build
```

### B. Database Backup

```bash
# Create backup script
sudo nano /usr/local/bin/backup-quiz-db.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/kmit-quiz"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U quiz_admin kmit_quiz | gzip > $BACKUP_DIR/quiz_db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "quiz_db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: quiz_db_$DATE.sql.gz"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-quiz-db.sh

# Schedule daily backup (2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-quiz-db.sh
```

### C. Monitoring

**Check Server Status:**
```bash
# Check if services are running
sudo systemctl status nginx
sudo systemctl status postgresql
pm2 status

# Check disk space
df -h

# Check memory
free -h

# Check logs
pm2 logs
sudo tail -f /var/log/nginx/error.log
```

---

## Firewall Configuration (Security)

**Allow only KMIT network:**
```bash
# Install UFW (if not installed)
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (for IT team)
sudo ufw allow from 10.11.0.0/16 to any port 22

# Allow HTTP
sudo ufw allow 80/tcp

# Allow PostgreSQL (internal only)
sudo ufw allow from 127.0.0.1 to any port 5432

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Configuration Summary

**Your URLs:**
```
Website:     http://10.11.x.x/
API:         http://10.11.x.x/api/
WebSocket:   http://10.11.x.x/socket.io/

Admin Login:
- Username: admin
- Password: KMIT@1234

Student Login:
- Username: <Roll Number>
- Password: <Roll Number>
```

**Server Paths:**
```
Application: /var/www/kmit-quiz/
Frontend:    /var/www/kmit-quiz/client/dist/
Backend:     /var/www/kmit-quiz/server/
Database:    PostgreSQL (localhost:5432)
Logs:        ~/.pm2/logs/
Backups:     /var/backups/kmit-quiz/
```

---

## Troubleshooting

### Issue: Can't Access from Browser

**Check:**
```bash
# Is Nginx running?
sudo systemctl status nginx

# Is backend running?
pm2 status

# Check Nginx config
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Database Connection Failed

**Check:**
```bash
# Is PostgreSQL running?
sudo systemctl status postgresql

# Test connection
psql -U quiz_admin -d kmit_quiz -h localhost

# Check DATABASE_URL in .env
cat /var/www/kmit-quiz/server/.env | grep DATABASE_URL
```

### Issue: 502 Bad Gateway

**Means:** Backend is not running

**Fix:**
```bash
pm2 restart kmit-quiz-backend
pm2 logs
```

---

## Performance Optimization

### A. Enable Gzip Compression

Add to Nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### B. Database Indexing

```sql
-- Add indexes for common queries
CREATE INDEX idx_user_username ON "User"(username);
CREATE INDEX idx_user_role ON "User"(role);
CREATE INDEX idx_quiz_code ON "Quiz"("joinCode");
CREATE INDEX idx_result_quiz ON "Result"("quizId");
```

### C. PM2 Cluster Mode

```bash
# Use all CPU cores
pm2 start server.js -i max --name kmit-quiz-backend
```

---

## Next Steps

1. ✅ Get server from IT team
2. ✅ Follow this deployment guide
3. ✅ Test with 10 students first
4. ✅ Tomorrow: 300 students test
5. ✅ After success: Officially launch

**Estimated Setup Time: 2-3 hours**

---

## Need Help?

**Common Commands Quick Reference:**
```bash
# Restart everything
pm2 restart all
sudo systemctl restart nginx

# View logs
pm2 logs
sudo tail -f /var/log/nginx/error.log

# Check status
pm2 status
sudo systemctl status nginx postgresql

# Update code
git pull && cd server && npm install && pm2 restart all
cd ../client && npm install && npm run build
```

**Contact KMIT IT Team for:**
- Server access issues
- Network/firewall issues
- IP address changes
- DNS setup

---

**This guide assumes Linux server. If Windows Server, I'll provide Windows-specific instructions.**
