#!/usr/bin/env python3
"""
FactoryAI on-site camera heartbeat agent.

FactoryAI marks a camera "online" only if it has phoned home recently. Our
cloud cannot reach cameras on a private factory network, so this agent runs
inside the plant, checks each camera itself, and reports the result.

Standard library only (Python 3.7+). Needs outbound HTTPS to the FactoryAI
project, and LAN access to the cameras/gateway. No inbound ports.

  python3 heartbeat_agent.py --config cameras.json --once --dry-run   # probe only
  python3 heartbeat_agent.py --config cameras.json --once             # one real pass
  python3 heartbeat_agent.py --config cameras.json                    # run forever
"""
import argparse
import json
import logging
import signal
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

log = logging.getLogger("heartbeat-agent")
UA = "factoryai-heartbeat-agent/1.0"


def probe_hls(url, timeout):
    """A live HLS stream serves a playlist starting with #EXTM3U."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        head = r.read(2048).decode("utf-8", "replace")
    if not head.lstrip().startswith("#EXTM3U"):
        return False, "response is not an HLS playlist"
    return True, "ok"


def probe_http(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return (200 <= r.status < 400), f"HTTP {r.status}"


def probe_tcp(url, timeout):
    """`url` is host:port (e.g. 172.21.11.213:554 for an RTSP recorder)."""
    host, _, port = url.rpartition(":")
    with socket.create_connection((host, int(port)), timeout=timeout):
        return True, "port open"


PROBES = {"hls": probe_hls, "http": probe_http, "tcp": probe_tcp}


def check_camera(cam, timeout):
    probe = cam["probe"]
    try:
        return PROBES[probe["type"]](probe["url"], timeout)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:  # unreachable host, timeout, refused, bad URL...
        return False, str(getattr(e, "reason", e))


def send_heartbeat(endpoint, cam, status, timeout):
    body = json.dumps({"camera_id": cam["id"], "token": cam["token"], "status": status}).encode()
    req = urllib.request.Request(
        endpoint, data=body, method="POST",
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return True, f"HTTP {r.status}"
    except urllib.error.HTTPError as e:
        detail = e.read(300).decode("utf-8", "replace")
        if e.code == 401:
            return False, "camera id/token rejected (re-check cameras.json against Admin > IP Cameras & AI)"
        return False, f"HTTP {e.code} {detail}"
    except Exception as e:
        return False, str(getattr(e, "reason", e))


def load_config(path):
    with open(path) as f:
        cfg = json.load(f)
    problems = []
    if not str(cfg.get("heartbeat_url", "")).startswith("http"):
        problems.append("heartbeat_url is missing")
    cams = cfg.get("cameras") or []
    if not cams:
        problems.append("cameras is empty")
    for i, c in enumerate(cams):
        label = c.get("name") or f"cameras[{i}]"
        for key in ("id", "token"):
            if not c.get(key) or "PASTE" in str(c[key]):
                problems.append(f"{label}: {key} not filled in")
        probe = c.get("probe") or {}
        if probe.get("type") not in PROBES or not probe.get("url"):
            problems.append(f"{label}: probe needs type ({'/'.join(PROBES)}) and url")
    if problems:
        sys.exit("Config problems:\n  - " + "\n  - ".join(problems))
    return cfg


def run_cycle(cfg, dry_run, last_state):
    timeout = float(cfg.get("timeout_seconds", 10))
    report_offline = bool(cfg.get("report_offline", True))
    cams = cfg["cameras"]

    with ThreadPoolExecutor(max_workers=min(16, len(cams))) as pool:
        results = list(pool.map(lambda c: check_camera(c, timeout), cams))

    online = 0
    for cam, (alive, detail) in zip(cams, results):
        name = cam.get("name") or cam["id"][:8]
        online += alive
        if last_state.get(cam["id"]) != alive:
            log.info("%s is now %s (%s)", name, "ONLINE" if alive else "OFFLINE", detail)
            last_state[cam["id"]] = alive
        if dry_run:
            log.info("[dry-run] %s: %s (%s)", name, "reachable" if alive else "unreachable", detail)
            continue
        if not alive and not report_offline:
            continue  # stay silent; the app flips it offline after ~3 missed beats
        ok, msg = send_heartbeat(cfg["heartbeat_url"], cam, "online" if alive else "offline", timeout)
        if not ok:
            log.error("%s: heartbeat not delivered: %s", name, msg)
    log.info("cycle done: %d/%d cameras reachable", online, len(cams))


def main():
    ap = argparse.ArgumentParser(description="FactoryAI on-site camera heartbeat agent")
    ap.add_argument("--config", default="cameras.json")
    ap.add_argument("--once", action="store_true", help="run a single pass and exit")
    ap.add_argument("--dry-run", action="store_true", help="probe cameras but send nothing")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config(args.config)
    interval = max(15, int(cfg.get("interval_seconds", 60)))

    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())

    last_state = {}
    while not stop.is_set():
        started = time.time()
        run_cycle(cfg, args.dry_run, last_state)
        if args.once:
            break
        stop.wait(max(1, interval - (time.time() - started)))


if __name__ == "__main__":
    main()
