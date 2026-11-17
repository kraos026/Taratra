"""Public negative checks, with an explicit optional real free-only mission."""
import argparse
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ssh", required=True)
    parser.add_argument("--identity", required=True)
    parser.add_argument("--known-hosts", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--submit-as-user")
    args = parser.parse_args()
    remote = "python3 -c 'import json;from pathlib import Path;print(json.loads(Path(\"/opt/optivos-hermes-gateway/config/pilot-gateway.env\").read_text().split(\"=\",1)[1]))'"
    key = subprocess.check_output([args.ssh, "-i", args.identity, "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile="+args.known_hosts, "root@2.24.172.127", remote], text=True, stderr=subprocess.PIPE, timeout=15).strip()
    if len(key) != 64:
        raise RuntimeError("Private pilot credential unavailable")
    opener = build_opener(NoRedirect)

    def request(path, method="GET", body=None, auth="valid"):
        headers = {"Content-Type": "application/json", "X-Optivos-Workspace-Id": args.workspace}
        if auth != "missing":
            headers["Authorization"] = "Bearer " + (key if auth == "valid" else "wrong")
        req = Request("https://srv2059450.hstgr.cloud"+path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
        try:
            with opener.open(req, timeout=18) as response:
                return response.status, json.loads(response.read(524289))
        except HTTPError as error:
            return error.code, None

    checks = []
    before_status, before = request("/pilot/missions")
    if before_status != 200:
        raise RuntimeError("Pilot unavailable before certification")
    cases = [
        ("/pilot/readiness", "GET", None, "missing", 404),
        ("/pilot/readiness", "GET", None, "invalid", 404),
        ("/api/sessions", "GET", None, "valid", 404),
        ("/v1/runs", "POST", {"input": "do not execute"}, "valid", 404),
        ("/pilot/readiness?extra=1", "GET", None, "valid", 404),
        ("/pilot/missions", "POST", {"id": "invalid"}, "valid", 400),
        ("/pilot/missions", "POST", {"id": str(uuid4()), "userId": str(uuid4()), "prompt": "Invalid model injection", "model": "paid-model"}, "valid", 400),
        ("/pilot/readiness", "GET", None, "valid", 200),
    ]
    readiness = None
    for path, method, body, auth, expected in cases:
        status, value = request(path, method, body, auth)
        if status != expected:
            raise RuntimeError(f"Failed {method} {path}: {status}")
        checks.append({"method": method, "path": path, "auth": auth, "status": status})
        if path == "/pilot/readiness" and status == 200:
            readiness = value
    status, after = request("/pilot/missions")
    if status != 200 or before["items"] != after["items"]:
        raise RuntimeError("Negative checks unexpectedly changed the mission registry")
    evidence = {"negativeAndReadinessChecks": checks, "registryUnchangedByNegativeChecks": True, "readiness": readiness, "inferenceSubmitted": False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.submit_as_user:
        intent_path = args.output.parent / "first-free-mission-intent.json"
        if intent_path.exists():
            intent = json.loads(intent_path.read_text(encoding="utf-8"))
            if intent["userId"] != args.submit_as_user:
                raise RuntimeError("Refusing to rebind an existing mission intent")
        else:
            intent = {"id": str(uuid4()), "userId": args.submit_as_user,
                      "prompt": "Rédige en français une procédure d’accueil client en exactement cinq lignes numérotées, avec une phrase par étape et 150 mots maximum au total. Pour chaque étape : action, responsable humain et résultat attendu. Aucun outil, aucune donnée inventée sur une entreprise réelle."}
            intent_path.write_text(json.dumps(intent, ensure_ascii=False, indent=2), encoding="utf-8")
        status, _ = request("/pilot/missions", "POST", intent)
        if status not in (200, 202):
            raise RuntimeError(f"Mission admission rejected: {status}; intent retained")
        evidence["inferenceSubmitted"] = True
        for _ in range(19):
            status, value = request("/pilot/missions/"+intent["id"])
            if status != 200:
                raise RuntimeError("Mission status unavailable; no admission replay")
            evidence["mission"] = value["data"]
            args.output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
            if value["data"]["status"] not in ("queued", "running", "stopping"):
                break
            time.sleep(5)
        mission = evidence["mission"]
        print(json.dumps({"missionId": intent["id"], "status": mission["status"], "proof": mission["proof"], "outputCharacters": len(mission["output"] or ""), "evidence": str(args.output)}))
    else:
        print(json.dumps({"preflight": "PASS", "checks": len(checks), "modelCalls": 0, "readiness": readiness}))


if __name__ == "__main__":
    main()
