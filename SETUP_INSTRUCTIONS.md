# Quick Setup Instructions for MesonEx API

## ⚠️ IMPORTANT - Certificate Error Fix

If you received this code as a ZIP file and are getting certificate errors, follow these steps:

### Step 1: Install Dependencies

Open a terminal/command prompt in the project directory and run:

```bash
npm install
```

### Step 2: Generate SSL Certificates

**This is the most important step!** Run:

```bash
node scripts/generate-certs.js
```

You should see output like:
```
Detected network IP: 192.168.x.x
Detected hostname: YOUR-COMPUTER-NAME
Generating self-signed certificates with multiple hostnames...
Created certs directory
✓ Certificate generated: certs/server.cert
✓ Private key generated: certs/server.key
Certificates are valid for 365 days
```

### Step 3: Create Environment File

Create a file named `.env.development` in the root directory with this content:

```env
# MongoDB Configuration
MONGO_URI=mongodb://127.0.0.1:27017/mesonex

# Server Configuration
PORT=4000

# CORS Configuration
CORS_ORIGIN=https://127.0.0.1:3000
```

### Step 4: Make Sure MongoDB is Running

Ensure MongoDB is installed and running on your system.

### Step 5: Run the Application

```bash
npm run start:dev
```

You should see:
```
Connected to MongoDB
HTTPS Server is running on https://0.0.0.0:4000
Access locally: https://127.0.0.1:4000
```

## Common Errors and Solutions

### Error: "Cannot find module 'selfsigned'"

**Solution:**
```bash
npm install
```

### Error: "ENOENT: no such file or directory, open 'certs/server.cert'"

**Solution:**
```bash
node scripts/generate-certs.js
```

### Error: "MongoDB connection failed: connect ECONNREFUSED"

**Solution:** Install and start MongoDB on your system.

### Browser shows "Your connection is not private"

**Solution:** This is normal for self-signed certificates in development. Click "Advanced" and "Proceed to 127.0.0.1" (or similar option depending on your browser).

## Need Help?

Contact the developer or check the full README.md for more details.
