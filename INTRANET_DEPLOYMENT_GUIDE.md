# College Intranet Deployment & Testing Guide

This guide explains how to configure, run, and test the Quiz Application within a local college intranet (Local Area Network / LAN). 

By hosting on an intranet, the backend server, frontend website, and database all run on local machines on your campus network, eliminating any dependence on external services like Render, Vercel, or cloud databases.

---

## Architecture Overview

On an intranet, machines communicate using local IP addresses (e.g., `192.168.x.x` or `10.x.x.x`). 

```
┌────────────────────────────────────────────────────────┐
│             Local Intranet / Campus LAN                │
│                                                        │
│   ┌──────────────────┐          ┌──────────────────┐   │
│   │ Local PostgreSQL │ ◄──────► │ Node.js Backend  │   │
│   │    Database      │          │ Server (Pt 5000) │   │
│   └──────────────────┘          └────────┬─────────┘   │
│                                          │             │
│                     ┌────────────────────┴────┐        │
│                     ▼                         ▼        │
│             ┌──────────────┐           ┌──────────────┐│
│             │  Teacher PC  │           │  Student PC  ││
│             │  (Frontend)  │           │  (Frontend)  ││
│             └──────────────┘           └──────────────┘│
└────────────────────────────────────────────────────────┘
```

---

## 1. Prerequisites & Finding Your Intranet IP

To host the servers, you need to identify the intranet IP address of the machine acting as the **Host Server**.

### On Windows (Host Server):
1. Open **Command Prompt** or **PowerShell**.
2. Run the command:
   ```cmd
   ipconfig
   ```
3. Locate your active network adapter (e.g., `Wireless LAN adapter Wi-Fi` or `Ethernet adapter`).
4. Look for the **IPv4 Address** (e.g., `192.168.1.50` or `10.0.0.12`). This is your **Host Server IP**.

---

## 2. Configuration Changes

### A. Backend (`server/.env`)
1. Create or open the `server/.env` file on the host machine.
2. Update the environment variables:
   ```env
   # Bind the server to your intranet port
   PORT=5000

   # Set database URL to local PostgreSQL (running on host or dedicated local DB server)
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/quiz_db

   # Secure JWT Token secret key
   JWT_SECRET=your_super_secret_intranet_jwt_key

   # CORS CONFIGURATION: Allow the local IP address of your frontend host
   ALLOWED_ORIGINS=http://192.168.1.50:5173,http://localhost:5173
   ```
   > ⚠️ **Note:**
   > Replace `192.168.1.50` with your actual **Host Server IP**.
   > If the database is hosted on a different local computer than the Node.js backend, replace `localhost` in the `DATABASE_URL` with that database machine's intranet IP address.

### B. Frontend (`client/.env.production` / `client/.env.local`)
To point the frontend to the intranet backend, edit `client/.env.production` (or `.env.local` if running development testing):
```env
VITE_API_URL=http://192.168.1.50:5000/api
VITE_SOCKET_URL=http://192.168.1.50:5000
```
> ⚠️ **Important:**
> Change `192.168.1.50` to your **Host Server IP**.
> Since this is on the intranet, use `http://` instead of `https://` (unless you have local SSL certificates installed).

---

## 3. How to Test Intranet Setup Locally

Before deploying to the entire campus, you can test the intranet setup on your local development machine and a secondary device (like a phone or tablet) connected to the same Wi-Fi.

### Step 1: Start the Local Database
Ensure your local PostgreSQL server is running on the host machine and the schema is pushed:
```bash
# From the server directory:
npx prisma db push
```

### Step 2: Start the Backend Server
```bash
# From the server directory:
npm run dev
```
The server will output: `Server running on port 5000`.

### Step 3: Run the Frontend in Network-Sharing Mode
Start the Vite development server with the `--host` flag to make it visible across the local network:
```bash
# From the client directory:
npm run dev -- --host
```
Vite will print two URLs in your terminal:
1. **Local**: `http://localhost:5173/` (for the host machine itself)
2. **Network**: `http://192.168.1.50:5173/` (for other devices on the intranet)

### Step 4: Test Connectivity
1. **On the Host Machine:**
   Open `http://localhost:5173` or `http://192.168.1.50:5173` to test login, quiz creation, and student views.
2. **On a Second Device (e.g., Phone or another Laptop on the same Wi-Fi):**
   - Connect the device to the **same Wi-Fi network**.
   - Open a browser and go to: `http://192.168.1.50:5173` (use your host machine's IP).
   - Enter student credentials, click login, and join a live quiz game.
   - If the student joins successfully and receives real-time quiz updates, your intranet config is working perfectly!

---

## 4. Production Hosting on College Intranet

When ready to host permanently:

1. **Build the Frontend:**
   ```bash
   # From the client directory
   npm run build
   ```
   This generates optimized static files in the `client/dist` folder.

2. **Serve the Frontend:**
   You can serve the `client/dist` directory using a simple static file server on the host machine:
   ```bash
   # Install global static server helper (or use Nginx / IIS)
   npm install -g serve
   serve -s client/dist -l 5173
   ```

3. **Run the Backend in Production:**
   Use a process manager like **PM2** to keep the backend running in the background and auto-restart if the machine reboots:
   ```bash
   npm install -g pm2
   cd server
   pm2 start index.js --name "quiz-backend"
   ```

---

## 5. Troubleshooting Intranet Issues

| Issue | Cause | Solution |
|---|---|---|
| **"Network Error" on Login or Blank Screen** | Firewall blocking port `5000` or `5173`. | Open Windows Defender Firewall -> **Advanced Settings** -> **Inbound Rules** -> Add Port Rules to allow inbound connections on TCP ports `5000` and `5173`. |
| **"Not allowed by CORS" console error** | Request IP address doesn't match `ALLOWED_ORIGINS`. | Verify that the `ALLOWED_ORIGINS` in your `server/.env` contains the exact URL (IP and Port) where you are loading the frontend. |
| **Second device cannot load the page** | Devices are on different subnets or Isolation Mode is active. | Ensure both devices are on the exact same Wi-Fi SSID and that "Access Point Isolation" (AP Isolation) is disabled in the router settings. |
| **Database connection fails (P1001)** | Local PostgreSQL server is not listening on network interfaces. | Edit `postgresql.conf` on your database machine and set `listen_addresses = '*'` instead of `127.0.0.1`. Restart PostgreSQL service. |
