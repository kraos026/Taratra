"""Root-only additive setup on the already authorized VPS; no inference."""
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import subprocess
from uuid import UUID

ROOT = Path("/opt/optivos-hermes-gateway")


def write(path, text, mode=0o600):
    if path.is_symlink():
        raise RuntimeError("Refusing linked managed file")
    if path.exists() and path.read_text() != text:
        raise RuntimeError("Existing managed file differs; explicit review required")
    if not path.exists():
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
        with os.fdopen(descriptor, "w") as file:
            file.write(text)
    path.chmod(mode)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--organization", required=True)
    args = parser.parse_args()
    if os.geteuid() != 0 or subprocess.check_output(["hostname", "-f"], text=True).strip() != "srv2059450.hstgr.cloud":
        raise RuntimeError("Only the existing named VPS root operator is supported")
    for value in (args.workspace, args.organization):
        if str(UUID(value)) != value:
            raise ValueError("Invalid binding")
    env_path = ROOT / "config" / "pilot-gateway.env"
    if env_path.exists():
        key = json.loads(env_path.read_text().split("=", 1)[1])
    else:
        key = secrets.token_hex(32)
    if not re.fullmatch(r"[0-9a-f]{64}", key):
        raise RuntimeError("Invalid dedicated credential")
    upstream = None
    for line in Path("/opt/hermes/data/.env").read_text().splitlines():
        if line.startswith("OPENROUTER_API_KEY="):
            values = shlex.split(line.split("=", 1)[1], comments=True)
            upstream = values[0] if len(values) == 1 else None
    if not upstream or not re.fullmatch(r"[A-Za-z0-9._-]{24,256}", upstream):
        raise RuntimeError("Existing provider credential unavailable; nothing printed")
    write(env_path, 'OPTIVOS_PILOT_KEY=' + json.dumps(key) + '\n')
    runtime = {"OPTIVOS_PILOT_KEY": key, "OPENROUTER_API_KEY": upstream,
               "OPTIVOS_WORKSPACE_ID": args.workspace, "OPTIVOS_ORGANIZATION_ID": args.organization}
    write(ROOT / "config" / "pilot-runtime.env", ''.join(k+'='+json.dumps(v)+'\n' for k,v in runtime.items()))
    source = ROOT / "pilot-source"
    unit = f'''[Unit]
Description=Optivos zero-fee isolated Hermes pilot
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory={source}
EnvironmentFile={ROOT}/config/pilot-runtime.env
Environment=PYTHONDONTWRITEBYTECODE=1
StateDirectory=optivos-hermes-pilot
StateDirectoryMode=0700
ExecStartPre=/usr/bin/docker exec --user 0 hermes install -d -m 755 /opt/optivos-free-pilot
ExecStartPre=/usr/bin/docker cp {source}/worker.py hermes:/opt/optivos-free-pilot/worker.py
ExecStartPre=/usr/bin/docker cp {source}/policy.py hermes:/opt/optivos-free-pilot/policy.py
ExecStart=/usr/bin/python3 -B {source}/service.py
Restart=on-failure
RestartSec=5
MemoryMax=256M
TasksMax=40
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
ReadWritePaths=/var/lib/optivos-hermes-pilot

[Install]
WantedBy=multi-user.target
'''
    write(Path("/etc/systemd/system/optivos-hermes-pilot.service"), unit, 0o644)
    drop = Path("/etc/systemd/system/optivos-hermes-gateway.service.d")
    drop.mkdir(mode=0o755, exist_ok=True)
    write(drop / "pilot.conf", f"[Service]\nEnvironmentFile={env_path}\n", 0o644)
    config_path = ROOT / "config" / "Caddyfile"
    original = config_path.read_text()
    marker = "    @pilot_read {"
    addition = '''    @pilot_read {
        method GET
        path_regexp pilotread ^/pilot/(readiness|missions|missions/[0-9a-f-]{36})$
        header Authorization "Bearer {$OPTIVOS_PILOT_KEY}"
        expression `{http.request.uri.query} == ""`
    }
    @pilot_write {
        method POST
        path_regexp pilotwrite ^/pilot/(missions|missions/[0-9a-f-]{36}/(stop|review))$
        header Authorization "Bearer {$OPTIVOS_PILOT_KEY}"
        expression `{http.request.uri.query} == ""`
    }
    handle @pilot_read {
        reverse_proxy 127.0.0.1:18646 {
            transport http {
                response_header_timeout 14s
                read_timeout 15s
            }
        }
    }
    handle @pilot_write {
        request_body {
            max_size 8KB
        }
        reverse_proxy 127.0.0.1:18646 {
            transport http {
                response_header_timeout 14s
                read_timeout 15s
            }
        }
    }
'''
    old_route = '        path_regexp pilotwrite ^/pilot/(missions|missions/[0-9a-f-]{36}/stop)$'
    new_route = '        path_regexp pilotwrite ^/pilot/(missions|missions/[0-9a-f-]{36}/(stop|review))$'
    if marker not in original or old_route in original:
        if original.count('    handle {\n        respond "Not found" 404') != 1 or original.count(old_route) > 1:
            raise RuntimeError("Unexpected existing gateway config; no overwrite")
        candidate = original.replace(old_route, new_route) if marker in original else original.replace('    handle {\n        respond "Not found" 404', addition + '    handle {\n        respond "Not found" 404')
        candidate_path = ROOT / "config" / "Caddyfile.pilot-candidate"
        write(candidate_path, candidate, 0o644)
        env = dict(os.environ)
        for file in (ROOT / "config" / "gateway.env", env_path):
            env.update({k:json.loads(v) for k,v in (line.split('=',1) for line in file.read_text().splitlines())})
        validation = subprocess.run([str(ROOT / "runtime/usr/bin/caddy"), "validate", "--config", str(candidate_path), "--adapter", "caddyfile"], env=env, capture_output=True)
        if validation.returncode:
            raise RuntimeError("Gateway validation failed; no secret-bearing diagnostics printed")
        write(ROOT / "config" / ("Caddyfile.before-review" if marker in original else "Caddyfile.before-pilot"), original, 0o644)
        os.replace(candidate_path, config_path)
    print(json.dumps({"prepared": True, "activated": False, "modelCalls": 0, "nativeHermesConfigChanged": False}))


if __name__ == "__main__":
    main()
