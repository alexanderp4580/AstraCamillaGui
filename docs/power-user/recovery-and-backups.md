# Recovery and Backups

**Intended audience:** Power users managing AstraCamillaGui data and disaster recovery.

**This document does not cover:** Development workflows or version control.

---

## What to Back Up

### Critical Data

**Must back up:**
- `/opt/astracamillagui/data/` - All user data
  - `configs/*.json` - User-saved presets
  - `configs/autoeq/` - AutoEQ library (if using)
  - `latest_dsp_state.json` - Recovery cache

**Size:** 
- User presets: ~1-5 KB each
- AutoEQ library: ~25-30 MB (if present)

**Loss impact:** Loss of saved presets, AutoEQ library, and recovery state

**Note:** AutoEQ library is committed to the repo, but backing it up with user data ensures you don't lose any custom imports.

---

### Configuration

**Should back up:**
- `/etc/astracamillagui/astracamillagui.env` - Environment variables
- `/etc/systemd/system/astracamillagui.service` - Service definition (if modified)

**Size:** <10 KB total

**Loss impact:** Need to reconfigure from scratch

---

### Application Code

**Optional to back up:**
- `/opt/astracamillagui/server/` - Built application
- `/opt/astracamillagui/package.json` - Dependency metadata

**Size:** ~20-30 MB

**Loss impact:** Can rebuild from source

**Reason to back up:** Avoids rebuild time, preserves exact version

---

### Not Needed

**Do not back up:**
- `/opt/astracamillagui/node_modules/` - Can reinstall with `npm ci`
- Logs (in journal) - System manages retention
- `/tmp/` - Ephemeral

---

## Backup Strategies

### Manual Backup

**Quick snapshot:**
```bash
# Create timestamped backup
DATE=$(date +%Y%m%d-%H%M%S)
sudo tar czf astracamillagui-backup-$DATE.tar.gz \
  /opt/astracamillagui/data \
  /etc/astracamillagui \
  /etc/systemd/system/astracamillagui.service

# Store safely
sudo mv astracamillagui-backup-$DATE.tar.gz /path/to/safe/location/
```

---

### Automated Daily Backup

**Script:** `/usr/local/bin/backup-astracamillagui.sh`
```bash
#!/bin/bash
set -e

BACKUP_DIR=/mnt/usb/backups
DATE=$(date +%Y%m%d)
KEEP_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup data
tar czf $BACKUP_DIR/astracamillagui-data-$DATE.tar.gz \
  /opt/astracamillagui/data

# Backup configuration
tar czf $BACKUP_DIR/astracamillagui-config-$DATE.tar.gz \
  /etc/astracamillagui \
  /etc/systemd/system/astracamillagui.service

# Remove old backups (keep last 30 days)
find $BACKUP_DIR -name "astracamillagui-*.tar.gz" -mtime +$KEEP_DAYS -delete

# Log completion
echo "$(date): Backup completed" >> /var/log/astracamillagui-backup.log
```

**Make executable:**
```bash
sudo chmod +x /usr/local/bin/backup-astracamillagui.sh
```

**Schedule via cron:**
```bash
sudo crontab -e
```

Add:
```
# Daily backup at 3 AM
0 3 * * * /usr/local/bin/backup-astracamillagui.sh
```

---

### Remote Backup

**Rsync to remote server:**
```bash
#!/bin/bash
# /usr/local/bin/backup-astracamillagui-remote.sh

rsync -avz --delete \
  /opt/astracamillagui/data/ \
  user@backup-server:/backups/astracamillagui/data/

rsync -avz \
  /etc/astracamillagui/ \
  /etc/systemd/system/astracamillagui.service \
  user@backup-server:/backups/astracamillagui/config/
```

**Setup SSH key:**
```bash
# As root (if running backup as root)
sudo ssh-keygen
sudo ssh-copy-id user@backup-server
```

---

## Restore Procedures

### Full Restore from Backup

**Scenario:** Fresh install or catastrophic failure

**Steps:**
```bash
# 1. Stop service (if running)
sudo systemctl stop astracamillagui

# 2. Extract data backup
cd /
sudo tar xzf /path/to/astracamillagui-data-YYYYMMDD.tar.gz

# 3. Extract config backup
sudo tar xzf /path/to/astracamillagui-config-YYYYMMDD.tar.gz

# 4. Set ownership
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data

# 5. Reload systemd (if service file changed)
sudo systemctl daemon-reload

# 6. Start service
sudo systemctl start astracamillagui

# 7. Verify
sudo systemctl status astracamillagui
curl http://localhost:3000/health
```

---

### Restore Only Presets

**Scenario:** Accidentally deleted preset

**From backup:**
```bash
# Extract to temp location
mkdir /tmp/restore
cd /tmp/restore
tar xzf /path/to/astracamillagui-data-YYYYMMDD.tar.gz

# Copy specific preset
sudo cp opt/astracamillagui/data/configs/my-preset.json \
  /opt/astracamillagui/data/configs/

# Set ownership
sudo chown astracamillagui:astracamillagui /opt/astracamillagui/data/configs/my-preset.json

# No restart needed (loaded on-demand)
```

---

### Restore Recovery Cache

**Scenario:** Corrupt `latest_dsp_state.json`

**From backup:**
```bash
# Stop service
sudo systemctl stop astracamillagui

# Extract recovery cache
cd /tmp
tar xzf /path/to/astracamillagui-data-YYYYMMDD.tar.gz opt/astracamillagui/data/latest_dsp_state.json

# Copy to live location
sudo cp opt/astracamillagui/data/latest_dsp_state.json /opt/astracamillagui/data/

# Set ownership
sudo chown astracamillagui:astracamillagui /opt/astracamillagui/data/latest_dsp_state.json

# Start service
sudo systemctl start astracamillagui
```

---

## Verification

### Verify Backup Integrity

**Test extraction:**
```bash
# Extract to temp directory
mkdir /tmp/backup-test
cd /tmp/backup-test
tar xzf /path/to/astracamillagui-data-YYYYMMDD.tar.gz

# Verify JSON files are valid
for f in opt/astracamillagui/data/configs/*.json; do
  if ! jq empty "$f" 2>/dev/null; then
    echo "Invalid JSON: $f"
  fi
done

# Clean up
cd /
rm -rf /tmp/backup-test
```

---

### Verify Restore Success

**After restore:**
```bash
# 1. Service running
sudo systemctl status astracamillagui
# Expected: active (running)

# 2. HTTP responsive
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# 3. Presets accessible
curl http://localhost:3000/api/configs
# Expected: JSON array of configs

# 4. Data directory permissions
ls -la /opt/astracamillagui/data
# Expected: astracamillagui:astracamillagui ownership

# 5. Check logs for errors
sudo journalctl -u astracamillagui -n 50 --no-pager
# Expected: No errors, "Server listening" message
```

---

## Disaster Recovery Scenarios

### Scenario 1: Data Directory Deleted

**Symptoms:**
- Presets page empty
- "Config not found" errors in logs

**Recovery:**
```bash
# Stop service
sudo systemctl stop astracamillagui

# Restore from backup
sudo tar xzf /path/to/backup.tar.gz opt/astracamillagui/data

# Set ownership
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data

# Start service
sudo systemctl start astracamillagui
```

**Verify:** Presets page shows saved presets

---

### Scenario 2: Corrupt Recovery Cache

**Symptoms:**
- Service starts but errors when accessing `/api/state/latest`
- "Invalid JSON" in logs

**Recovery Option 1 - From backup:**
```bash
sudo systemctl stop astracamillagui
sudo tar xzf /path/to/backup.tar.gz opt/astracamillagui/data/latest_dsp_state.json
sudo chown astracamillagui:astracamillagui /opt/astracamillagui/data/latest_dsp_state.json
sudo systemctl start astracamillagui
```

**Recovery Option 2 - Delete and recreate:**
```bash
# Delete corrupt file
sudo rm /opt/astracamillagui/data/latest_dsp_state.json

# Service will create new empty cache on next write
sudo systemctl restart astracamillagui
```

**Note:** Recovery cache is best-effort. Losing it is non-fatal.

---

### Scenario 3: SD Card Failure (SBC)

**Symptoms:**
- System won't boot
- I/O errors in kernel log

**Recovery:**
```bash
# 1. Replace SD card
# 2. Reinstall OS
# 3. Reinstall AstraCamillaGui (see linux-services.md)
# 4. Restore data from backup:

sudo systemctl stop astracamillagui
sudo tar xzf /path/to/backup.tar.gz
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data
sudo systemctl start astracamillagui
```

**Prevention:** Regular backups to USB or network storage

---

### Scenario 4: Accidentally Deleted Preset

**Symptoms:**
- Preset missing from Presets page
- "Config not found" error when loading

**Recovery:**
```bash
# Extract from backup to temp
mkdir /tmp/restore
cd /tmp/restore
tar xzf /path/to/backup.tar.gz

# List available presets
ls opt/astracamillagui/data/configs/

# Copy specific preset
sudo cp opt/astracamillagui/data/configs/my-preset.json \
  /opt/astracamillagui/data/configs/

sudo chown astracamillagui:astracamillagui /opt/astracamillagui/data/configs/my-preset.json

# Clean up
rm -rf /tmp/restore
```

**No restart needed** - presets loaded on-demand

---

### Scenario 5: Upgrade Failed

**Symptoms:**
- Service won't start after upgrade
- "Module not found" or version mismatch errors

**Recovery:**
```bash
# 1. Stop service
sudo systemctl stop astracamillagui

# 2. Restore application backup (if available)
sudo tar xzf /path/to/app-backup.tar.gz

# 3. Or rebuild from source
cd /path/to/source
git checkout v1.0.0  # or last known-good version
npm install
npm run build
sudo cp -r server/dist /opt/astracamillagui/server
cd /opt/astracamillagui
sudo npm ci --omit=dev

# 4. Set ownership
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui

# 5. Start service
sudo systemctl start astracamillagui
```

---

## File Corruption Detection

### Check JSON Validity

**All presets:**
```bash
cd /opt/astracamillagui/data/configs
for f in *.json; do
  echo -n "Checking $f... "
  if jq empty "$f" 2>/dev/null; then
    echo "OK"
  else
    echo "CORRUPT"
  fi
done
```

**Recovery cache:**
```bash
jq empty /opt/astracamillagui/data/latest_dsp_state.json \
  && echo "OK" || echo "CORRUPT"
```

---

### Check Permissions

```bash
# Data directory should be owned by service user
ls -ld /opt/astracamillagui/data
# Expected: drwxr-xr-x ... astracamillagui astracamillagui

# Configs should be readable/writable by service
ls -l /opt/astracamillagui/data/configs/
# Expected: -rw-r--r-- ... astracamillagui astracamillagui
```

**Fix permissions:**
```bash
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data
sudo chmod 755 /opt/astracamillagui/data
sudo chmod 755 /opt/astracamillagui/data/configs
sudo chmod 644 /opt/astracamillagui/data/configs/*.json
sudo chmod 644 /opt/astracamillagui/data/latest_dsp_state.json
```

---

## Backup Testing

### Monthly Backup Test

**Best practice:** Test restore quarterly

**Procedure:**
```bash
# 1. Create test environment (separate directory)
sudo mkdir -p /tmp/restore-test/opt/astracamillagui
sudo mkdir -p /tmp/restore-test/etc

# 2. Extract backup
cd /tmp/restore-test
sudo tar xzf /path/to/backup.tar.gz

# 3. Verify structure
ls -R opt/astracamillagui/data
ls etc/astracamillagui

# 4. Validate JSON files
for f in opt/astracamillagui/data/configs/*.json; do
  jq empty "$f" || echo "FAILED: $f"
done

# 5. Clean up
cd /
sudo rm -rf /tmp/restore-test
```

**Document results** - date tested, outcome

---

## Data Migration

### Move to New Server

**On old server:**
```bash
# Create complete backup
sudo tar czf astracamillagui-migration.tar.gz \
  /opt/astracamillagui/data \
  /etc/astracamillagui \
  /etc/systemd/system/astracamillagui.service

# Transfer to new server
scp astracamillagui-migration.tar.gz user@new-server:/tmp/
```

**On new server:**
```bash
# Install AstraCamillaGui (see linux-services.md)
# Then restore data:

sudo systemctl stop astracamillagui
cd /
sudo tar xzf /tmp/astracamillagui-migration.tar.gz
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data
sudo systemctl daemon-reload
sudo systemctl start astracamillagui
```

---

### Export Presets for Sharing

**Export single preset:**
```bash
# Copy from server
scp user@server:/opt/astracamillagui/data/configs/my-preset.json ./

# Share file (email, USB, etc.)
```

**Import on another system:**
```bash
# Copy to server
scp my-preset.json user@server:/tmp/

# On server:
sudo cp /tmp/my-preset.json /opt/astracamillagui/data/configs/
sudo chown astracamillagui:astracamillagui /opt/astracamillagui/data/configs/my-preset.json
```

**No restart needed** - appears immediately in UI

---

## Common Failure Modes

### Disk Full

**Symptoms:**
- "No space left on device" in logs
- Preset saves fail
- Service may crash

**Recovery:**
```bash
# Check disk usage
df -h

# Free space (delete logs, temp files)
sudo journalctl --vacuum-size=100M
sudo apt clean

# Move data directory to larger partition (if needed)
sudo systemctl stop astracamillagui
sudo mv /opt/astracamillagui/data /mnt/usb/astracamillagui-data
sudo ln -s /mnt/usb/astracamillagui-data /opt/astracamillagui/data
sudo systemctl start astracamillagui
```

---

### Permission Errors

**Symptoms:**
- "EACCES" or "Permission denied" in logs
- Preset saves fail silently

**Recovery:**
```bash
# Fix ownership
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data

# Fix permissions
sudo chmod 755 /opt/astracamillagui/data
sudo chmod 755 /opt/astracamillagui/data/configs
sudo chmod 644 /opt/astracamillagui/data/configs/*.json

# Restart service
sudo systemctl restart astracamillagui
```

---

### Missing Data Directory

**Symptoms:**
- Service starts but "ENOENT" errors in logs
- Presets page empty

**Recovery:**
```bash
# Stop service
sudo systemctl stop astracamillagui

# Recreate structure
sudo mkdir -p /opt/astracamillagui/data/configs
sudo chown -R astracamillagui:astracamillagui /opt/astracamillagui/data

# Restore from backup (if available)
sudo tar xzf /path/to/backup.tar.gz opt/astracamillagui/data

# Start service
sudo systemctl start astracamillagui
```

---

## Backup Retention

### Recommended Policy

**Local backups:**
- Daily: Keep 7 days
- Weekly: Keep 4 weeks
- Monthly: Keep 12 months

**Remote backups:**
- Weekly: Keep 12 weeks
- Monthly: Keep indefinitely (or until space constraint)

---

### Cleanup Script

```bash
#!/bin/bash
# /usr/local/bin/cleanup-old-backups.sh

BACKUP_DIR=/mnt/usb/backups

# Keep last 7 daily backups
find $BACKUP_DIR -name "astracamillagui-data-*.tar.gz" -mtime +7 -delete

# Keep last 30 days of config backups
find $BACKUP_DIR -name "astracamillagui-config-*.tar.gz" -mtime +30 -delete

echo "$(date): Cleanup completed" >> /var/log/backup-cleanup.log
```

**Schedule weekly:**
```bash
# Run Sunday at 4 AM
0 4 * * 0 /usr/local/bin/cleanup-old-backups.sh
```

---

## Next Steps

- [Deployment Models](deployment-models.md) - Architecture overview
- [Linux Services](linux-services.md) - Service management
- [Headless SBC](headless-sbc.md) - SBC-specific deployment
