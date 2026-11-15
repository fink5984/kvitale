# Device agent: installation & operations

Covers installing `apps/device-agent` (Python package `kvittel_agent`) on a Raspberry Pi field unit:
pairing, logs, updates, paper-roll replacement, and a security checklist.

> **Status:** these steps follow standard Raspberry Pi OS practice and the agent's own design.
> Nobody has run them end-to-end on a production unit with real hardware yet. Steps marked
> **UNVERIFIED** need to be confirmed on the first real unit, and this document updated.

Target hardware: **Raspberry Pi Zero 2 W** or **Raspberry Pi 4** running **Raspberry Pi OS Lite**
(Bookworm or later, 64-bit recommended). Hardware candidates are in [HARDWARE_BOM.md](HARDWARE_BOM.md).

---

## 1. Flash the OS

1. Use Raspberry Pi Imager and choose *Raspberry Pi OS Lite (64-bit)*.
2. In Imager's OS customisation:
   - Set the hostname, e.g. `kvittel-<site>-<n>`.
   - Create an admin user with a unique name (not `pi`) and a long random password. The password
     is only for local console recovery.
   - **SSH: enable with "public-key authentication only"** and paste the operator's public key.
   - Configure Wi-Fi (country code is required). Use Ethernet where the site has it.
   - Set the locale and timezone. The agent works in UTC and corrects drift from `serverTime`.
3. Prefer a **high-endurance** microSD card, or boot from USB SSD on a Pi 4. The journal fsyncs on
   every state change.

## 2. Base system

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y python3-venv python3-serial python3-gpiozero python3-lgpio unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades      # enable automatic security updates
```

`python3-serial` is only needed for serial printers, and `python3-gpiozero`/`python3-lgpio`
only for the GPIO chute sensor. The agent core is stdlib-only.

## 3. Service user and directories

```bash
sudo useradd --system --home-dir /var/lib/kvittel-agent --shell /usr/sbin/nologin kvittel
sudo usermod -aG lp,dialout,gpio kvittel             # printer (usblp), serial, GPIO
sudo install -d -o root -g root -m 0755 /opt/kvittel-agent
sudo install -d -o root -g kvittel -m 0750 /etc/kvittel-agent
sudo install -d -o kvittel -g kvittel -m 0700 /var/lib/kvittel-agent
```

The code under `/opt` is owned by root and **not writable by the agent**. The agent can only
write to `/var/lib/kvittel-agent`, which holds credentials, the journal, the outbox and state.

## 4. Install the agent

Copy a release of `apps/device-agent` to the Pi, e.g. `scp kvittel-agent-0.1.0.tar.gz admin@unit:`.
Then:

```bash
sudo mkdir -p /opt/kvittel-agent/releases/0.1.0
sudo tar -xzf kvittel-agent-0.1.0.tar.gz -C /opt/kvittel-agent/releases/0.1.0 --strip-components=1
# --system-site-packages lets the venv use apt's pyserial / gpiozero / lgpio
sudo python3 -m venv --system-site-packages /opt/kvittel-agent/venv
sudo /opt/kvittel-agent/venv/bin/pip install --no-deps /opt/kvittel-agent/releases/0.1.0
sudo cp /opt/kvittel-agent/releases/0.1.0/README.md /opt/kvittel-agent/README.md

# optional: run the test suite on the device
cd /opt/kvittel-agent/releases/0.1.0 && python3 -m unittest discover -s tests
```

## 5. Configuration

```bash
sudo cp /opt/kvittel-agent/releases/0.1.0/config.example.toml /etc/kvittel-agent/config.toml
sudo chown root:kvittel /etc/kvittel-agent/config.toml && sudo chmod 0640 /etc/kvittel-agent/config.toml
sudo nano /etc/kvittel-agent/config.toml
```

Set at least `server_url`, `[printer] adapter/device/model`, and `[chute] adapter/gpio_pin`. Leave
every `*_verified` flag at `false` until the checklist in HARDWARE_BOM.md passes on this exact
printer model and firmware.

## 6. Printer udev rule

```bash
lsusb                                   # find the printer, e.g. "ID XXXX:YYYY ..."
lsmod | grep usblp || sudo modprobe usblp
ls -l /dev/usb/lp*                      # usblp device node
sudo cp /opt/kvittel-agent/releases/0.1.0/udev/99-kvittel-printer.rules /etc/udev/rules.d/
sudo nano /etc/udev/rules.d/99-kvittel-printer.rules   # put in the real idVendor / idProduct
sudo udevadm control --reload && sudo udevadm trigger
ls -l /dev/kvittel-printer              # expect a symlink to usb/lp0, group lp, mode 0660
```

For a serial printer, use the `tty` rule from the same file and set `connection = "serial"`.

## 7. Bench test (no server)

```bash
sudo -u kvittel /opt/kvittel-agent/venv/bin/kvittel-agent --config /etc/kvittel-agent/config.toml test-print-local
sudo -u kvittel /opt/kvittel-agent/venv/bin/kvittel-agent --config /etc/kvittel-agent/config.toml diagnostics
```

The test pattern has no customer content: a border, diagonals, a density ladder and 1 mm ticks
along the bottom edge (at 8 dots/mm). If the ticks don't match a ruler, `width_dots`/`dots_per_mm`
are wrong for this printer.

## 8. Pairing

1. An admin opens **Admin → Devices → Pair new unit** and selects the grave. The code is valid for
   30 minutes and can be used once. The grave assignment comes from this code, never from GPS.
2. On the unit:

```bash
sudo -u kvittel /opt/kvittel-agent/venv/bin/kvittel-agent --config /etc/kvittel-agent/config.toml \
     pair --code 7H2K-9QXD --server https://kvittel.example
ls -l /var/lib/kvittel-agent/credentials.json      # must be: -rw------- kvittel kvittel
```

Errors: `invalid_code`, `code_expired_or_used` (create a new code), `rate_limited` (wait).
To re-pair, revoke the unit in the admin UI, then run `pair ... --force`.

The token is used **only** with the server it was paired with. A different `server_url` in config
is ignored for authenticated calls. The agent rotates the token every 30 days on its own.

## 9. Enable the service

```bash
sudo cp /opt/kvittel-agent/releases/0.1.0/systemd/kvittel-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kvittel-agent
systemd-analyze security kvittel-agent        # review the exposure score
```

**UNVERIFIED:** the unit's `DeviceAllow=` class names (`char-usb`, `char-ttyS`, `char-gpiochip`, …)
and `MemoryDenyWriteExecute=` with lgpio have not been confirmed on a Pi. If the printer or GPIO
can't be opened, compare against `grep -E 'usb|tty|gpio' /proc/devices`.

### Optional: allow the signed `reboot_agent` command to reboot the Pi

By default the hook is `"disabled"`: the command is logged and reported as failed. To allow it,
set `reboot_agent = ["/usr/bin/systemctl", "reboot"]` and add a polkit rule.
**UNVERIFIED** on Bookworm's polkit:

```js
// /etc/polkit-1/rules.d/50-kvittel-reboot.rules
polkit.addRule(function (action, subject) {
  if ((action.id == "org.freedesktop.login1.reboot" ||
       action.id == "org.freedesktop.login1.reboot-multiple-sessions") && subject.user == "kvittel")
    return polkit.Result.YES;
});
```

`restart_service = "exit"` needs no extra privilege: the agent exits with code 75 and systemd
restarts it.

## 10. Logs and diagnostics

```bash
journalctl -u kvittel-agent -f                      # live
journalctl -u kvittel-agent --since "1 hour ago"
sudo -u kvittel /opt/kvittel-agent/venv/bin/kvittel-agent --config /etc/kvittel-agent/config.toml diagnostics
```

Logs contain only ids, digests, states and error codes. They never contain raster data or names.
If you ever see content in a log, treat it as a bug and an incident.

Useful states in `diagnostics`:

- `paused.hold`: `chute_timeout` or `cutter_jam`. The agent has stopped leasing jobs until an
  admin sends **Clear error**.
- `journal.inFlight`: entries that will be reported as `interrupted` on the next start.
- `outbox.depth`: events waiting for the network.

Spool files (`/var/lib/kvittel-agent/spool/`):

- `journal.jsonl`: append-only print journal. **Never delete it on a unit in service.** It is
  what prevents a slip from printing twice.
- `outbox.json`: pending uploads.
- `commands_seen.json`, `state.json`: command de-duplication, plus local pause/hold.

## 11. Updating

OTA is **not** implemented: the `ota_update` command answers `ota_not_supported`. Updates are an
operator procedure:

1. In the admin UI, **pause** the unit. Wait until it shows no active job. A heartbeat with
   `activeJob: null` is enough.
2. `sudo systemctl stop kvittel-agent`
3. Unpack the new release into `/opt/kvittel-agent/releases/<ver>`, then run
   `sudo /opt/kvittel-agent/venv/bin/pip install --no-deps --force-reinstall /opt/kvittel-agent/releases/<ver>`
4. Compare `config.example.toml` against your config. The agent refuses unknown keys, so a renamed
   key fails loudly.
5. `sudo systemctl start kvittel-agent && journalctl -u kvittel-agent -n 50`
6. Run a **Test print** from the admin UI, then **resume**.

Rollback: reinstall the previous release directory the same way. The spool format is versioned
(`"v": 1`). Do not delete the spool.

## 12. Replacing a paper roll (operator steps)

1. In the admin UI, **pause** the unit. If paper ran out mid-service, the server has already marked
   the affected job. Never reprint anything by hand.
2. Open the enclosure lock. If a slip is **half-printed or hanging** from the printer, leave it
   alone and don't tear it off. Note the time and report it; that job is already flagged
   `uncertain` for review.
3. Open the printer cover and remove the empty core.
4. Insert the new roll (the spec is in HARDWARE_BOM.md). The **thermal-coated side faces the
   print head**. If you're unsure which side is coated, a fingernail scratch leaves a dark mark on
   that side. Pull a few cm past the tear bar/cutter and close the cover firmly.
5. Check that the chute is clear (no stuck slip, no debris), and wipe the chute sensor's lenses if
   they're dusty.
6. In the admin UI, run **Test print**. Confirm the slip is legible, cut completely, and drops
   through the chute.
7. If the unit shows a hold (`chute_timeout` or `cutter_jam`), send **Clear error**. Then
   **resume**.
8. Lock the enclosure. Take the empty core with you. Printed slips inside the chute or receptacle
   are never removed or read by the operator, except as the site's policy says.

## 13. Security checklist

- [ ] **No inbound ports** except SSH. The agent opens none. Check with `sudo ss -tlnp`. Consider
      a firewall (`nftables`) that allows only outbound traffic plus SSH from a management network
      or VPN.
- [ ] **SSH with keys only**: `PasswordAuthentication no`, `KbdInteractiveAuthentication no` and
      `PermitRootLogin no` in `/etc/ssh/sshd_config.d/`. Remove keys for anyone who no longer
      needs access.
- [ ] **Token file is 0600**, owned by `kvittel`: `/var/lib/kvittel-agent/credentials.json`.
      The state directory is 0700.
- [ ] Config is `root:kvittel 0640`. Code under `/opt/kvittel-agent` is root-owned and not
      writable by `kvittel`.
- [ ] **unattended-upgrades** is enabled for security updates. Reboot regularly in a maintenance
      window outside service hours.
- [ ] Hooks stay `"disabled"` unless a reboot path is actually needed (and verified).
- [ ] `allow_insecure_http = false`, with `server_url` on `https://`. Use `ca_file` only for a
      private CA you control.
- [ ] Bluetooth is disabled if unused (`dtoverlay=disable-bt` in `/boot/firmware/config.txt`).
      Wi-Fi is limited to the site network.
- [ ] If a camera is installed, it points **only at the slot exit, never at people** (see BOM).
- [ ] Losing a unit (theft, damage): revoke it in **Admin → Devices** right away. Revoking
      invalidates the token, and the command key goes with it.
- [ ] **Read-only root (optional):** `raspi-config` → Performance → Overlay file system protects
      the SD card and resists tampering. **But** `/var/lib/kvittel-agent` must then sit on a
      separate persistent partition mounted read-write (e.g. a second partition or USB stick in
      `/etc/fstab`). Otherwise the journal is lost on every reboot and the
      never-print-twice guarantee is gone. **UNVERIFIED** procedure; test power-cut behaviour
      before relying on it.
