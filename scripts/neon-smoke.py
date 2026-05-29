#!/usr/bin/env python3
"""Smoke-test a Neon API key without printing the secret.

Usage:
  NEON_API_KEY=... python scripts/neon-smoke.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://console.neon.tech/api/v2"
ENDPOINTS = [
    ("current user", "/users/me"),
    ("organizations", "/users/me/organizations"),
    ("projects", "/projects?limit=20"),
    ("api keys", "/api_keys"),
]


def summarize(payload: object) -> str:
    if isinstance(payload, dict):
        parts: list[str] = []
        for key in ("user", "organizations", "projects", "api_keys", "keys"):
            value = payload.get(key)
            if isinstance(value, list):
                parts.append(f"{key}={len(value)}")
            elif isinstance(value, dict):
                safe = value.get("email") or value.get("name") or value.get("id") or "object"
                parts.append(f"{key}={safe}")
        if parts:
            return ", ".join(parts)
    return type(payload).__name__


def request(path: str, key: str) -> tuple[int, str]:
    req = urllib.request.Request(
        urllib.parse.urljoin(BASE, path),
        headers={"Accept": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode("utf-8", "replace")
            try:
                return res.status, summarize(json.loads(raw) if raw else {})
            except json.JSONDecodeError:
                return res.status, raw[:120]
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            body = json.loads(raw) if raw else {}
            message = body.get("message") or body.get("error") or body.get("detail") or summarize(body)
        except json.JSONDecodeError:
            message = raw[:120]
        return exc.code, str(message)


def main() -> int:
    key = os.environ.get("NEON_API_KEY", "").strip()
    if not key:
        print("Set NEON_API_KEY before running this smoke test.", file=sys.stderr)
        return 2

    print(f"Testing Neon API key ({key[:5]}…{key[-4:]}, length={len(key)})")
    exit_code = 0
    for label, path in ENDPOINTS:
        try:
            status, detail = request(path, key)
        except Exception as exc:  # noqa: BLE001 - smoke-test should report environment failures
            print(f"WARN {label}: network error: {exc}")
            exit_code = 1
            continue
        marker = "OK" if 200 <= status < 300 else "WARN"
        if marker != "OK":
            exit_code = 1
        print(f"{marker} {label}: HTTP {status} — {detail}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
