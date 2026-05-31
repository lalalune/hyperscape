# Environment Setup and Server Configuration

Complete guide to setting up Asset Forge servers for development, staging, and production environments including Node.js/Bun installation, process management, reverse proxy configuration, and SSL/TLS setup.

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Node.js and Bun Installation](#nodejs-and-bun-installation)
3. [PM2 Process Management](#pm2-process-management)
4. [nginx Reverse Proxy](#nginx-reverse-proxy)
5. [SSL/TLS Setup](#ssltls-setup)
6. [Environment Variables](#environment-variables)
7. [Database Setup](#database-setup)
8. [Security Hardening](#security-hardening)

## Server Requirements

### Minimum Requirements

| Component | Development | Production |
|-----------|-------------|------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4GB | 8GB+ |
| **Storage** | 20GB SSD | 100GB+ SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### Recommended Stack

- **OS**: Ubuntu 22.04 LTS
- **Runtime**: Node.js 18+ or Bun 1.0+
- **Process Manager**: PM2
- **Reverse Proxy**: nginx
- **SSL**: Let's Encrypt (certbot)
- **Firewall**: ufw

## Node.js and Bun Installation

### Node.js Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # v18.x.x
npm --version   # 9.x.x

# Install build tools
sudo apt install -y build-essential
```

### Bun Installation (Alternative)

```bash
# Install Bun (faster than Node.js)
curl -fsSL https://bun.sh/install | bash

# Add to PATH
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify installation
bun --version  # 1.x.x
```

### Global Package Installation

```bash
# Install PM2 globally
npm install -g pm2

# Install deployment tools
npm install -g serve
npm install -g concurrently
```

## PM2 Process Management

### Installation and Setup

```bash
# Install PM2
npm install -g pm2

# Enable PM2 startup on boot
pm2 startup systemd

# Follow the outputted command, e.g.:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### PM2 Configuration

**File:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'asset-forge-api',
      script: 'server/api.mjs',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3004
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'asset-forge-images',
      script: 'scripts/start-image-server.mjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        IMAGE_PORT: 8080
      },
      error_file: './logs/images-error.log',
      out_file: './logs/images-out.log',
      max_memory_restart: '500M',
      autorestart: true
    },
    {
      name: 'asset-forge-frontend',
      script: 'serve',
      args: '-s dist -l 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log'
    }
  ]
}
```

### PM2 Commands

```bash
# Start all applications
pm2 start ecosystem.config.js

# Start specific app
pm2 start ecosystem.config.js --only asset-forge-api

# Stop applications
pm2 stop asset-forge-api
pm2 stop all

# Restart applications
pm2 restart asset-forge-api
pm2 restart all

# Reload (zero-downtime restart)
pm2 reload asset-forge-api
pm2 reload all

# Delete applications
pm2 delete asset-forge-api
pm2 delete all

# View logs
pm2 logs asset-forge-api
pm2 logs asset-forge-api --lines 100
pm2 logs --err  # Error logs only

# Monitor resources
pm2 monit

# List running processes
pm2 list

# Show detailed info
pm2 describe asset-forge-api

# Save process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

## nginx Reverse Proxy

### Installation

```bash
# Install nginx
sudo apt install -y nginx

# Enable and start nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Check status
sudo systemctl status nginx
```

### nginx Configuration

**File:** `/etc/nginx/sites-available/asset-forge`

```nginx
# Upstream servers
upstream api_backend {
    least_conn;
    server localhost:3004;
    keepalive 64;
}

upstream image_backend {
    server localhost:8080;
    keepalive 32;
}

upstream frontend_backend {
    server localhost:3000;
    keepalive 16;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name assetforge.com www.assetforge.com;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name assetforge.com www.assetforge.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/assetforge.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assetforge.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Frontend static files
    location / {
        proxy_pass http://frontend_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2)$ {
            proxy_pass http://frontend_backend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Longer timeouts for AI operations
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;

        # Large body size for base64 images
        client_max_body_size 25M;
    }

    # Assets endpoint
    location /assets/ {
        limit_req zone=general_limit burst=50 nodelay;

        proxy_pass http://image_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Cache 3D models and images
        expires 1d;
        add_header Cache-Control "public";
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://api_backend/api/health;
    }
}
```

### Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/asset-forge /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Create webroot directory
sudo mkdir -p /var/www/certbot

# Obtain certificate
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d assetforge.com \
  -d www.assetforge.com \
  --email admin@assetforge.com \
  --agree-tos \
  --no-eff-email

# Auto-renewal setup
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e
# Add line:
0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

### Manual SSL Setup

If using custom certificates:

```bash
# Copy certificates
sudo cp fullchain.pem /etc/ssl/certs/assetforge-fullchain.pem
sudo cp privkey.pem /etc/ssl/private/assetforge-privkey.pem

# Set permissions
sudo chmod 644 /etc/ssl/certs/assetforge-fullchain.pem
sudo chmod 600 /etc/ssl/private/assetforge-privkey.pem

# Update nginx configuration
ssl_certificate /etc/ssl/certs/assetforge-fullchain.pem;
ssl_certificate_key /etc/ssl/private/assetforge-privkey.pem;
```

## Environment Variables

### System-wide Environment Variables

**File:** `/etc/environment`

```bash
NODE_ENV=production
API_PORT=3004
IMAGE_PORT=8080
```

### Application Environment Variables

**File:** `package/asset-forge/.env.production`

```bash
# API Configuration
NODE_ENV=production
API_PORT=3004
IMAGE_SERVER_URL=https://images.assetforge.com

# Frontend URLs
VITE_API_URL=https://assetforge.com/api
VITE_GENERATION_API_URL=https://generation.assetforge.com/api
VITE_IMAGE_SERVER_URL=https://images.assetforge.com

# External Services
MESHY_API_KEY=msy_your_api_key_here
OPENAI_API_KEY=sk-your_api_key_here

# Security
ALLOWED_ORIGINS=https://assetforge.com,https://www.assetforge.com

# Database
DB_PATH=./data/assets.db

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

### Secure Environment Variable Management

```bash
# Create .env.production
touch .env.production
chmod 600 .env.production  # Only owner can read/write

# Never commit .env.production to git
echo ".env.production" >> .gitignore

# Use environment variable service (optional)
# - AWS Secrets Manager
# - HashiCorp Vault
# - doppler.com
```

## Database Setup

Asset Forge uses SQLite for asset storage (no server required).

### SQLite Configuration

```bash
# Install SQLite (usually pre-installed)
sudo apt install -y sqlite3

# Create data directory
mkdir -p data/
chmod 700 data/

# Initialize database
sqlite3 data/assets.db < schema.sql

# Set permissions
chmod 600 data/assets.db

# Backup script
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
cp data/assets.db backups/assets_${DATE}.db
# Keep only last 7 days
find backups/ -name "assets_*.db" -mtime +7 -delete

# Add to crontab
0 2 * * * /home/ubuntu/asset-forge/backup-db.sh
```

## Security Hardening

### Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to application ports
sudo ufw deny 3000/tcp
sudo ufw deny 3004/tcp
sudo ufw deny 8080/tcp

# Check status
sudo ufw status verbose
```

### Fail2Ban Setup

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure for nginx
sudo nano /etc/fail2ban/jail.local
```

**File:** `/etc/fail2ban/jail.local`

```ini
[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
findtime = 600
bantime = 3600
```

### User Permissions

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash assetforge

# Set ownership
sudo chown -R assetforge:assetforge /home/assetforge/asset-forge

# Run PM2 as assetforge user
sudo -u assetforge pm2 start ecosystem.config.js
```

### System Updates

```bash
# Enable automatic security updates
sudo apt install -y unattended-upgrades

# Configure
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Deployment Scripts

### Deployment Script

**File:** `deploy.sh`

```bash
#!/bin/bash
set -e  # Exit on error

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Build frontend
npm run build

# Build services
npm run build:services

# Restart PM2 processes
pm2 reload ecosystem.config.js

# Reload nginx
sudo systemctl reload nginx

echo "Deployment complete!"
```

### Health Check Script

**File:** `health-check.sh`

```bash
#!/bin/bash

# Check API health
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/api/health)

if [ "$API_STATUS" != "200" ]; then
  echo "API health check failed"
  pm2 restart asset-forge-api
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)

if [ "$FRONTEND_STATUS" != "200" ]; then
  echo "Frontend health check failed"
  pm2 restart asset-forge-frontend
fi
```

## Conclusion

Asset Forge server setup involves Node.js/Bun installation, PM2 process management, nginx reverse proxy configuration, SSL/TLS setup, and security hardening. Follow this guide to deploy reliable, secure production servers.

**Key Takeaways:**
- Use PM2 for process management and auto-restart
- Configure nginx as reverse proxy with caching
- Enable SSL/TLS with Let's Encrypt
- Secure environment variables
- Implement firewall and Fail2Ban
- Regular backups and updates
