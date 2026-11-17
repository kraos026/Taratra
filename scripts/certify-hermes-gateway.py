"""Certify public HTTPS consultation without inference or printing credentials."""

import argparse
import json
from pathlib import Path
import re
import ssl
import subprocess
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ssh", required=True)
    parser.add_argument("--identity", required=True)
    parser.add_argument("--known-hosts", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    # SSH returns the dedicated consultation key into process memory only.
    command = "python3 -c 'import json; from pathlib import Path; p=Path(\"/opt/optivos-hermes-gateway/config/gateway.env\"); values=dict(line.split(\"=\",1) for line in p.read_text().splitlines()); print(json.loads(values[\"OPTIVOS_GATEWAY_KEY\"]))'"
    key = subprocess.check_output([
        args.ssh, "-i", args.identity, "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
        "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=" + args.known_hosts,
        "root@2.24.172.127", command,
    ], stderr=subprocess.PIPE, timeout=20, text=True).strip()
    if not re.fullmatch(r"[0-9a-f]{64}", key):
        raise RuntimeError("Dedicated gateway key unavailable; nothing printed")
    context = ssl.create_default_context()
    opener = build_opener(HTTPSHandler(context=context), NoRedirect)
    checks = []
    cases = [
        ("GET", "/v1/capabilities", "missing", 404),
        ("GET", "/v1/capabilities", "invalid", 404),
        ("POST", "/v1/runs", "valid", 404),
        ("POST", "/v1/capabilities", "valid", 404),
        ("GET", "/api/sessions", "valid", 404),
        ("GET", "/api/config", "valid", 404),
        ("GET", "/v1/skills?extra=1", "valid", 404),
        ("GET", "/v1/runs/invalid", "valid", 404),
        ("GET", "/v1/capabilities", "valid", 200),
        ("GET", "/v1/skills", "valid", 200),
        ("GET", "/v1/toolsets", "valid", 200),
    ]
    for method, path, auth, expected in cases:
        headers = {} if auth == "missing" else {"Authorization": "Bearer " + (key if auth == "valid" else "wrong")}
        request = Request("https://srv2059450.hstgr.cloud" + path, headers=headers, method=method)
        try:
            with opener.open(request, timeout=10) as response:
                status = response.status
                body = response.read(131073)
        except HTTPError as error:
            status, body = error.code, b""
        if status != expected:
            raise RuntimeError(f"Public gateway check failed: {method} {path}: {status}")
        check = {"method": method, "path": path, "auth": auth, "status": status}
        if expected == 200:
            if len(body) > 131072:
                raise RuntimeError("Response exceeds certification limit")
            payload = json.loads(body)
            if not isinstance(payload, dict) or not payload.get("object"):
                raise RuntimeError("Unexpected native response contract")
            check["object"] = payload["object"]
            if isinstance(payload.get("data"), list):
                check["items"] = len(payload["data"])
        checks.append(check)
    result = {"status": "PASS", "tlsVerification": "system trust and hostname verification enabled",
              "origin": "https://srv2059450.hstgr.cloud", "checks": checks, "modelCalls": 0,
              "scope": "public transport only; not authenticated Optivos UI or tenant certification"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
