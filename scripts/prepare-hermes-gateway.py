"""Prepare a read-only, single-pilot gateway on the existing Linux VPS.

No API model call, native config change, package installation or public activation.
Root operator supplies the trusted Ubuntu Caddy binary after package extraction.
Secrets and generated service files must never be committed or printed.
"""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path("/opt/optivos-hermes-gateway")
UNIT = Path("/etc/systemd/system/optivos-hermes-gateway.service")
HOST = "srv2059450.hstgr.cloud"
LOCAL_PORT = 18645


def configuration(address):
    return '''{
    admin off
    auto_https disable_redirects
}
ADDRESS {
    @allowed {
        method GET
        path_regexp native ^/v1/(capabilities|skills|toolsets|runs/run_[0-9a-f]{32})$
        header Authorization "Bearer {$OPTIVOS_GATEWAY_KEY}"
        expression `{http.request.uri.query} == ""`
    }
    handle @allowed {
        reverse_proxy 127.0.0.1:8642 {
            header_up Authorization "Bearer {$HERMES_NATIVE_KEY}"
            transport http {
                dial_timeout 2s
                response_header_timeout 3s
                read_timeout 5s
            }
        }
    }
    handle {
        respond "Not found" 404
    }
}
'''.replace("ADDRESS", address)


def private_write(path, content, mode=0o600):
    if path.is_symlink():
        raise RuntimeError("Refusing symbolic link at managed path")
    if path.exists():
        if path.read_text() != content:
            raise RuntimeError("Existing managed file differs; explicit review required")
        if path.stat().st_uid != 0:
            raise RuntimeError("Unexpected managed file owner")
    else:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
        with os.fdopen(fd, "w") as output:
            output.write(content)
    path.chmod(mode)


def check_key(key):
    if not re.fullmatch(r"[A-Za-z0-9._~-]{24,256}", key):
        raise RuntimeError("Invalid secret format; no secret printed")
    return key


def run_checked(command, env):
    result = subprocess.run(command, env=env, capture_output=True, timeout=20)
    if result.returncode:
        # Caddy errors may contain substituted config; do not print them.
        raise RuntimeError("Caddy validation failed; no secret-bearing output printed")


def local_recipe(binary, env, config):
    # Prove the loopback port is unused before creating any process.
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", LOCAL_PORT))
    process = subprocess.Popen(
        [str(binary), "run", "--config", str(config), "--adapter", "caddyfile"],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    checks = []
    try:
        for _ in range(50):
            if process.poll() is not None:
                raise RuntimeError("Local gateway exited before recipe")
            try:
                with socket.create_connection(("127.0.0.1", LOCAL_PORT), timeout=0.1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Local gateway readiness timed out")
        cases = [
            ("GET", "/v1/capabilities", None, 404),
            ("GET", "/v1/capabilities", "wrong", 404),
            ("POST", "/v1/capabilities", env["OPTIVOS_GATEWAY_KEY"], 404),
            ("GET", "/v1/skills?extra=1", env["OPTIVOS_GATEWAY_KEY"], 404),
            ("GET", "/api/sessions", env["OPTIVOS_GATEWAY_KEY"], 404),
            ("GET", "/api/config", env["OPTIVOS_GATEWAY_KEY"], 404),
            ("POST", "/v1/runs", env["OPTIVOS_GATEWAY_KEY"], 404),
            ("GET", "/v1/runs/invalid", env["OPTIVOS_GATEWAY_KEY"], 404),
            ("GET", "/v1/capabilities", env["OPTIVOS_GATEWAY_KEY"], 200),
            ("GET", "/v1/skills", env["OPTIVOS_GATEWAY_KEY"], 200),
            ("GET", "/v1/toolsets", env["OPTIVOS_GATEWAY_KEY"], 200),
        ]
        for method, path, key, expected in cases:
            headers = {"Authorization": "Bearer " + key} if key else {}
            request = Request(f"http://127.0.0.1:{LOCAL_PORT}{path}", headers=headers, method=method)
            try:
                with urlopen(request, timeout=8) as response:
                    status = response.status
                    body = response.read(131073)
            except HTTPError as error:
                status, body = error.code, b""
            if status != expected:
                raise RuntimeError(f"Gateway recipe failed: {method} {path}: {status}")
            if expected == 200:
                payload = json.loads(body)
                if not isinstance(payload, dict) or not payload.get("object"):
                    raise RuntimeError("Unexpected native response contract")
            checks.append({"method": method, "path": path, "status": status})
        return checks
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True, type=Path)
    args = parser.parse_args()
    binary = args.binary.resolve(strict=True)
    host_fqdn = subprocess.check_output(["hostname", "--fqdn"], text=True, timeout=5).strip()
    if os.geteuid() != 0 or host_fqdn != HOST or socket.gethostname() != HOST.split(".")[0]:
        raise RuntimeError("This preparation is restricted to the named VPS root operator")
    if not binary.is_relative_to(ROOT) or not binary.is_file():
        raise RuntimeError("Caddy binary must be extracted within the owned gateway directory")
    for managed in (ROOT, ROOT / "config"):
        if managed.is_symlink():
            raise RuntimeError("Refusing linked managed directory")
        managed.mkdir(mode=0o755, parents=True, exist_ok=True)
        if managed.stat().st_uid != 0:
            raise RuntimeError("Unexpected directory owner")
    secret_path = ROOT / "config" / "gateway.env"
    if secret_path.exists():
        if secret_path.is_symlink() or secret_path.stat().st_uid != 0 or secret_path.stat().st_mode & 0o077:
            raise RuntimeError("Unexpected secret-file ownership or permissions")
        values = dict(line.split("=", 1) for line in secret_path.read_text().splitlines())
        keys = {key: check_key(json.loads(value)) for key, value in values.items()}
        if set(keys) != {"OPTIVOS_GATEWAY_KEY", "HERMES_NATIVE_KEY"}:
            raise RuntimeError("Unexpected secret-file keys")
    else:
        native = check_key(Path("/opt/hermes/secrets/api.key").read_text().strip())
        keys = {"OPTIVOS_GATEWAY_KEY": secrets.token_hex(32), "HERMES_NATIVE_KEY": native}
        private_write(secret_path, "".join(f"{key}={json.dumps(value)}\n" for key, value in keys.items()))
    env = {**os.environ, **keys}
    local = ROOT / "config" / "Caddyfile.local"
    public = ROOT / "config" / "Caddyfile"
    private_write(local, configuration(f"http://127.0.0.1:{LOCAL_PORT}"))
    private_write(public, configuration(HOST), 0o644)
    for file in (local, public):
        run_checked([str(binary), "validate", "--config", str(file), "--adapter", "caddyfile"], env)
    checks = local_recipe(binary, env, local)
    unit = f'''[Unit]
Description=Optivos Hermes read-only pilot gateway
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=notify
DynamicUser=yes
StateDirectory=optivos-hermes-gateway
StateDirectoryMode=0700
Environment=XDG_DATA_HOME=/var/lib/optivos-hermes-gateway
Environment=XDG_CONFIG_HOME=/var/lib/optivos-hermes-gateway
EnvironmentFile={secret_path}
ExecStart={binary} run --config {public} --adapter caddyfile
Restart=on-failure
RestartSec=5
TimeoutStopSec=10
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
'''
    private_write(UNIT, unit, 0o644)
    evidence = {"localRecipe": "PASS", "checks": checks, "modelCalls": 0,
                "publicServiceActivatedByScript": False, "host": HOST}
    private_write(ROOT / "config" / "local-recipe.json", json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence))


if __name__ == "__main__":
    main()
