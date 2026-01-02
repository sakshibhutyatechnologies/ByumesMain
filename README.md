# MesonEx API

MesonEx API is a Node.js application that provides an API for the MesonEx platform.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or accessible remotely)
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate SSL Certificates

**IMPORTANT:** The SSL certificates are not included in the repository for security reasons. You must generate them locally before running the application.

Run the certificate generation script:

```bash
node scripts/generate-certs.js
```

This will create:
- `certs/server.cert` - SSL certificate
- `certs/server.key` - Private key

The certificates are valid for 365 days and include support for:
- localhost
- 127.0.0.1
- Your machine's hostname
- Your local network IP address

### 3. Configure Environment Variables

Create a `.env.development` file in the root directory with the following content:

```env
# MongoDB Configuration
MONGO_URI=mongodb://127.0.0.1:27017/mesonex

# Server Configuration
PORT=4000

# CORS Configuration
CORS_ORIGIN=https://127.0.0.1:3000
```

Adjust the values according to your environment.

### 4. Seed Default Users (Optional)

If you need default users in the database:

```bash
node scripts/seedDefaultUsers.js
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run start:prod
```

### QA Mode

```bash
npm run start:qa
```

The server will start on `https://127.0.0.1:4000` (or your configured port).

## Accessing the API

- **Local access:** `https://127.0.0.1:4000`
- **Network access:** `https://<your-ip-address>:4000`

**Note:** Since this uses self-signed certificates, your browser will show a security warning. This is normal for development. You can safely proceed by accepting the certificate.

## Troubleshooting

### Certificate Error

If you get an error like:
```
Error: ENOENT: no such file or directory, open 'certs/server.cert'
```

**Solution:** Run the certificate generation script:
```bash
node scripts/generate-certs.js
```

### MongoDB Connection Error

If you get:
```
MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:** Make sure MongoDB is running on your system.

### Port Already in Use

If you get:
```
Error: listen EADDRINUSE: address already in use :::4000
```

**Solution:** Either:
1. Stop the process using port 4000
2. Change the PORT in your `.env.development` file

## Project Structure

```
mesonex-api-main/
├── certs/              # SSL certificates (generated locally)
├── models/             # Mongoose models
├── routes/             # API routes
├── scripts/            # Utility scripts
├── uploads/            # User uploaded files
├── public/             # Static files
├── app.js              # Main application file
├── configuration.js    # Configuration loader
└── package.json        # Dependencies
```

## API Endpoints

The API includes the following main endpoints:

- `/api/auth` - Authentication
- `/users` - User management
- `/orders` - Order management
- `/products` - Product management
- `/instructions` - Instructions
- `/masterInstructions` - Master instructions
- `/reports` - Reports
- `/equipments` - Equipment management
- `/companies` - Company management

## Author

Sneha Rangole

## License

ISC
