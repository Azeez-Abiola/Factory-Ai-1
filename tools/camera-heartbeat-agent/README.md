# FactoryAI on-site camera heartbeat agent

A camera shows **online** in FactoryAI only if it has phoned home in the last ~3 minutes.
The cloud can't reach cameras on a private factory network (e.g. `172.21.x.x`), so this
small agent runs **inside the plant**, checks each camera, and reports the result.

- Python 3.7+, standard library only. Nothing to install.
- Needs outbound HTTPS to the FactoryAI project. No inbound ports.
- Best place to run it: the machine that hosts your MediaMTX gateway.

## Setup

1. Copy this folder to the plant machine (e.g. `/opt/factoryai-heartbeat`).
2. Create `cameras.json` from `cameras.example.json`. For each camera you need its **id** and
   **ingest token** (Admin -> IP Cameras & AI -> the camera -> Heartbeat) and a `probe`:
   - `hls`  - stream playlist URL (best signal: proves the stream is really live)
   - `http` - any URL that answers 2xx/3xx
   - `tcp`  - `host:port` (e.g. an RTSP recorder on `:554`)
3. Lock the file down: `chmod 600 cameras.json` (the tokens are secrets).
4. Test:
   ```
   python3 heartbeat_agent.py --once --dry-run   # probes only, sends nothing
   python3 heartbeat_agent.py --once             # one real pass
   ```
5. Run it permanently:
   ```
   sudo cp factoryai-heartbeat.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now factoryai-heartbeat
   journalctl -u factoryai-heartbeat -f
   ```

## Behaviour

- Every `interval_seconds` (default 60) each camera is probed in parallel.
- Reachable -> heartbeat `online`. Unreachable -> heartbeat `offline` (set `report_offline: false`
  to stay silent instead; the app then flips it offline after ~3 missed beats).
- If the agent stops, cameras drop to offline within ~3 minutes. That is intentional.
- `401 camera id/token rejected` in the log means `cameras.json` doesn't match the camera in
  Admin -> IP Cameras & AI (tokens are per project; cameras copied from another project have new ones).
