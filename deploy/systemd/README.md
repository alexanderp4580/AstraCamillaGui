# AstraCamillaGui Systemd Deployment

This guide describes how to deploy a **AstraCamillaGui release artifact** on Linux systems using systemd (Debian, Ubuntu, Armbian on Orange Pi, etc.).

## Prerequisites

- Linux system with systemd
- Node.js >= 18.0.0 installed (`node --version` to check)
- AstraCamillaGui release tarball (download from GitHub Releases)

---

## Installation

### 1. Extract Release Artifact

```bash
# Download the release (replace VERSION with actual version)
wget https://github.com/alexanderp4580/AstraCamillaGui/releases/download/v0.1.2b/astracamillagui-v0.1.2b.tar.gz

# Extract to temporary location
tar -xzf astracamillagui-v0.1.0.tar.gz
cd astracamillagui-v0.1.0
```

### 2. Create Service User

```bash
sudo useradd -r -s /bin/false astracamillagui
```

### 3. Install Application

```bash
# Create installation directory
sudo mkdir -p /opt/astracamillagui

# Copy release contents to installation directory
sudo cp -r * /opt/astracamillagui/

# Install production dependencies
cd /opt/astracamillagui
sudo npm ci --omit=dev

# Fix ownership
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui
```

**Directory structure after installation:**
```
/opt/astracamillagui/
├── server/
│   └── dist/
│       ├── index.js          # Server entry point
│       ├── client/           # Pre-built UI assets
│       └── ...               # Compiled server modules
├── data/                     # Mutable: configs, state (WRITABLE by service)
│   └── configs/
│       └── ...
├── tools/                    # Helper scripts (optional)
├── deploy/                   # Deployment docs and examples
├── package.json              # Runtime-only dependencies
├── package-lock.json
└── node_modules/             # Installed after npm ci
```

**Mutable vs Immutable Paths:**
- **Mutable:** `./data/**` (configs, state - writable by service)
- **Immutable:** Everything else (code, tools, docs - read-only after install)

### 4. Configure Environment

```bash
# Create config directory
sudo mkdir -p /etc/astracamillagui

# Copy and customize environment file
sudo cp /opt/astracamillagui/deploy/systemd/astracamillagui.env.example /etc/astracamillagui/astracamillagui.env
sudo chown root:root /etc/astracamillagui/astracamillagui.env
sudo chmod 644 /etc/astracamillagui/astracamillagui.env

# Edit configuration
sudo nano /etc/astracamillagui/astracamillagui.env
```

**Key environment variables:**
- `SERVER_PORT=3000` - Port for web UI and API
- `SERVER_HOST=0.0.0.0` - Listen on all interfaces (or `127.0.0.1` for localhost only)
- `CAMILLA_CONTROL_WS_URL` - Default CamillaDSP control WebSocket URL (e.g., `ws://localhost:1234`)
- `CAMILLA_SPECTRUM_WS_URL` - Default CamillaDSP spectrum WebSocket URL (e.g., `ws://localhost:1235`)
- `LOG_LEVEL=info` - Logging level (error, warn, info, debug)

**Important:** The systemd service loads environment variables from `/etc/astracamillagui/astracamillagui.env` (via `EnvironmentFile=`). Changes require a service restart.

### 5. Install and Enable Service

```bash
# Copy service file
sudo cp /opt/astracamillagui/deploy/systemd/astracamillagui.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable astracamillagui

# Start service
sudo systemctl start astracamillagui

# Check status
sudo systemctl status astracamillagui
```

### 6. Verify Installation

```bash
# Check logs
sudo journalctl -u astracamillagui -n 50 --no-pager

# Test web UI (replace with your server IP if remote)
curl http://localhost:3000/
# Should return HTML containing "<div id="app">"

# Test API
curl http://localhost:3000/api/version
# Should return JSON with version info
```

---

## Post-Installation

### Access the UI

Open a web browser and navigate to:
```
http://<server-ip>:3000
```

Default: `http://localhost:3000` (if accessing from the same machine)

### Network Access

By default, AstraCamillaGui binds to `0.0.0.0:3000` (all interfaces). To access from other devices on your LAN, use the server's IP address.

To restrict access to localhost only (e.g., if using a reverse proxy):
```bash
# Edit /etc/astracamillagui/astracamillagui.env
SERVER_HOST=127.0.0.1

# Restart service
sudo systemctl restart astracamillagui
```

---

## Updating AstraCamillaGui

To update to a new release version:

```bash
# Stop service
sudo systemctl stop astracamillagui

# Backup mutable data (optional but recommended)
sudo cp -r /opt/astracamillagui/data /opt/astracamillagui/data.backup.$(date +%Y%m%d)

# Download and extract new release
cd /tmp
wget https://github.com/alexanderp4580/AstraCamillaGui/releases/download/v0.2.0/astracamillagui-v0.2.0.tar.gz
tar -xzf astracamillagui-v0.2.0.tar.gz

# Replace immutable files (preserves ./data)
sudo rm -rf /opt/astracamillagui/server
sudo rm -rf /opt/astracamillagui/tools
sudo rm -rf /opt/astracamillagui/deploy
sudo rm -rf /opt/astracamillagui/node_modules
sudo rm /opt/astracamillagui/package.json
sudo rm /opt/astracamillagui/package-lock.json

# Copy new release files
cd astracamillagui-v0.2.0
sudo cp -r server tools deploy package.json package-lock.json /opt/astracamillagui/

# Update dependencies
cd /opt/astracamillagui
sudo npm ci --omit=dev

# Fix ownership
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui

# Update service file if changed
sudo cp /opt/astracamillagui/deploy/systemd/astracamillagui.service /etc/systemd/system/
sudo systemctl daemon-reload

# Start service
sudo systemctl start astracamillagui

# Verify
sudo systemctl status astracamillagui
sudo journalctl -u astracamillagui -n 20 --no-pager
```

---

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u astracamillagui -n 100 --no-pager
```

**Common issues:**

1. **Unsupported Node.js version**
   ```
   ERROR: Unsupported Node.js version
   Current version: v16.x.x
   Required: >= 18.0.0 and < 23.0.0
   ```
   **Solution:** Upgrade Node.js to version 18 or 20 LTS.

2. **Port already in use**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   **Solution:** Change `SERVER_PORT` in `/etc/astracamillagui/astracamillagui.env` or stop conflicting service.

3. **Permission denied on /opt/astracamillagui/data**
   ```
   Error: EACCES: permission denied
   ```
   **Solution:** Fix ownership:
   ```bash
   sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data
   ```

4. **Missing dependencies**
   ```
   Error: Cannot find module '@fastify/static'
   ```
   **Solution:** Reinstall dependencies:
   ```bash
   cd /opt/astracamillagui
   sudo npm ci --omit=dev
   ```

### Environment Variables Not Loading

The service reads environment variables from `/etc/astracamillagui/astracamillagui.env`. Changes require a restart:
```bash
sudo systemctl restart astracamillagui
```

To verify which environment variables the running service sees:
```bash
# Get the service PID
sudo systemctl show astracamillagui -p MainPID

# Inspect process environment (replace <PID> with actual MainPID)
sudo tr '\0' '\n' < /proc/<PID>/environ | grep '^CAMILLA_\|^SERVER_'
```

### Manual Test (Bypass systemd)

Test the application manually to isolate systemd-specific issues:
```bash
cd /opt/astracamillagui
sudo -u astracamillagui NODE_ENV=production /usr/bin/node server/dist/index.js
```

Press `Ctrl+C` to stop. If this works but the service doesn't, check systemd configuration.

### View Real-Time Logs

```bash
# Follow logs in real-time
sudo journalctl -u astracamillagui -f

# View recent logs
sudo journalctl -u astracamillagui -n 100

# View logs since boot
sudo journalctl -u astracamillagui -b

# View logs with timestamps
sudo journalctl -u astracamillagui -n 50 -o short-iso
```

---

## Security

### Service Hardening

The included systemd unit applies these security measures:
- Runs as unprivileged user `astracamillagui`
- Only `./data/` is writable (`ReadWritePaths=/opt/astracamillagui/data`)
- System and home directories are protected
- Private `/tmp` namespace

### Read-Only Mode

When exposing AstraCamillaGui publicly, enable read-only mode to prevent unauthorized persistence changes:

```bash
# Edit /etc/astracamillagui/astracamillagui.env
SERVER_READ_ONLY=true

# Restart service
sudo systemctl restart astracamillagui
```

In read-only mode:
- ✅ UI loads and displays current state
- ✅ WebSocket connections to CamillaDSP work (volume, config, spectrum)
- ✅ GET requests succeed (read presets, read state)
- ❌ PUT/POST/PATCH/DELETE to `/api/*` return HTTP 403 (no disk writes)

### Reverse Proxy (Optional)

For HTTPS or authentication, use a reverse proxy like nginx or Caddy. See:
- `/opt/astracamillagui/deploy/caddy/README.md` for Caddy examples
- Standard nginx reverse proxy configuration

---

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop astracamillagui
sudo systemctl disable astracamillagui

# Remove service file
sudo rm /etc/systemd/system/astracamillagui.service
sudo systemctl daemon-reload

# Remove application files
sudo rm -rf /opt/astracamillagui

# Remove configuration
sudo rm -rf /etc/astracamillagui

# Remove service user
sudo userdel astracamillagui
```

---

## Additional Resources

- **GitHub Repository:** https://github.com/alexanderp4580/AstraCamillaGui
- **Reverse Proxy Examples:** `/opt/astracamillagui/deploy/caddy/README.md`
- **Helper Tools:** `/opt/astracamillagui/tools/README.md`
- **CamillaDSP Documentation:** https://github.com/HEnquist/camilladsp

For build/development instructions (power users), see the developer documentation in the repository.
