"""Single-workspace VPS pilot: durable queue + strict free-only model proxy.

Native Hermes configuration is untouched. A short-lived unprivileged AIAgent runs
one text turn, without tools, using only a temporary credential for this proxy.
"""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import subprocess
import threading
import time
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

from policy import CATALOG_TTL, MODEL, PolicyError, require_free, safe_completion, verified_usage


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def uuid(value):
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("Invalid UUID")
    return value


class Pilot:
    def __init__(self, path, workspace, organization, gateway_key, upstream_key):
        self.path, self.workspace, self.organization = path, uuid(workspace), uuid(organization)
        self.gateway_key, self.upstream_key = gateway_key, upstream_key
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.closing = threading.Event()
        self.active = {}
        self.catalog, self.checked = None, 0
        self.opener = build_opener(NoRedirect)
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with self.db() as con:
            con.execute("create table if not exists pilot_state(key text primary key,value text not null)")
            for key, value in (("workspace", self.workspace), ("organization", self.organization)):
                existing = con.execute("select value from pilot_state where key=?", (key,)).fetchone()
                if existing and existing[0] != value:
                    raise RuntimeError("Refusing to rebind a persisted pilot database")
                con.execute("insert or ignore into pilot_state values(?,?)", (key, value))
            self.suspended = con.execute("select 1 from pilot_state where key='suspended'").fetchone() is not None
            con.execute("create table if not exists missions(id text primary key,workspace_id text not null,organization_id text not null,created_by text not null,prompt text not null,status text not null,created_at real not null,updated_at real not null,output text,error text,proof text)")
            con.execute("create table if not exists reviews(sequence integer primary key autoincrement,id text unique not null,mission_id text not null,user_id text not null,decision text not null,comment text not null,previous_id text,created_at real not null)")
            con.execute("update missions set status='interrupted',error='Exécution interrompue ; aucun rejeu automatique.',updated_at=? where status in ('running','stopping')", (time.time(),))
        self.path.chmod(0o600)

    @contextmanager
    def db(self):
        con = sqlite3.connect(self.path, timeout=5)
        con.row_factory = sqlite3.Row
        try:
            with con:
                yield con
        finally:
            con.close()

    def fresh_policy(self):
        with self.lock:
            if self.suspended:
                raise PolicyError("Contrôle financier suspendu ; vérification requise.")
            if not 0 <= time.time() - self.checked < CATALOG_TTL:
                request = Request("https://openrouter.ai/api/v1/models", headers={"User-Agent": "Optivos-zero-fee-pilot/1"})
                with self.opener.open(request, timeout=10) as response:
                    raw = response.read(8_388_609)
                if len(raw) > 8_388_608:
                    raise PolicyError("Catalogue trop volumineux.")
                catalog = json.loads(raw)
                checked = time.time()
                require_free(catalog, checked)
                self.catalog, self.checked = catalog, checked
            return require_free(self.catalog, self.checked)

    def listing(self, mission_id=None):
        with self.lock, self.db() as con:
            query = "select * from missions where workspace_id=? and organization_id=?"
            args = [self.workspace, self.organization]
            if mission_id:
                query += " and id=?"
                args.append(uuid(mission_id))
            rows = con.execute(query + " order by created_at desc,id limit 21", args).fetchall()
        items = []
        for row in rows[:20]:
            item = dict(row)
            item.pop("workspace_id")
            item.pop("organization_id")
            item.pop("created_by")
            item["proof"] = json.loads(item["proof"]) if item["proof"] else None
            with self.db() as con:
                item["reviews"] = [dict(review) for review in con.execute("select id,decision,comment,created_at from reviews where mission_id=? order by sequence", (item["id"],))]
            items.append(item)
        return {"items": items, "hasMore": len(rows) > 20}

    def review(self, mission_id, body):
        mission_id = uuid(mission_id)
        if not isinstance(body, dict) or set(body) != {"id", "userId", "decision", "comment", "previousId"}:
            raise ValueError("Invalid review")
        review_id, user_id = uuid(body["id"]), uuid(body["userId"])
        previous = uuid(body["previousId"]) if body["previousId"] is not None else None
        decision, comment = body["decision"], body["comment"]
        if decision not in ("accepted", "changes_requested") or not isinstance(comment, str) or len(comment) > 500 or (decision == "changes_requested" and len(comment.strip()) < 10):
            raise ValueError("Invalid review")
        comment = comment.strip()
        with self.lock, self.db() as con:
            mission = con.execute("select * from missions where id=? and workspace_id=? and organization_id=?", (mission_id, self.workspace, self.organization)).fetchone()
            if not mission:
                return 404
            if mission["status"] != "completed" or not mission["output"] or not mission["proof"]:
                return 409
            existing = con.execute("select * from reviews where id=?", (review_id,)).fetchone()
            if existing:
                return 200 if (existing["mission_id"], existing["user_id"], existing["decision"], existing["comment"], existing["previous_id"]) == (mission_id, user_id, decision, comment, previous) else 409
            rows = con.execute("select id from reviews where mission_id=? order by sequence", (mission_id,)).fetchall()
            if (rows[-1]["id"] if rows else None) != previous:
                return 409
            if len(rows) >= 20:
                return 429
            con.execute("insert into reviews(id,mission_id,user_id,decision,comment,previous_id,created_at) values(?,?,?,?,?,?,?)", (review_id, mission_id, user_id, decision, comment, previous, time.time()))
        return 200

    def create(self, body):
        if not isinstance(body, dict) or set(body) != {"id", "prompt", "userId"}:
            raise ValueError("Invalid mission input")
        mission_id, user_id = uuid(body["id"]), uuid(body["userId"])
        prompt = body["prompt"]
        if not isinstance(prompt, str) or not 10 <= len(prompt.strip()) <= 2000:
            raise ValueError("Invalid mission text")
        prompt = prompt.strip()
        with self.lock, self.db() as con:
            previous = con.execute("select * from missions where id=?", (mission_id,)).fetchone()
            if previous:
                if previous["workspace_id"] != self.workspace or previous["organization_id"] != self.organization or previous["prompt"] != prompt or previous["created_by"] != user_id:
                    return 409
                return 200
        self.fresh_policy()  # No job admitted on unknown, nonzero or stale pricing.
        with self.lock, self.db() as con:
            if con.execute("select count(*) from missions").fetchone()[0] >= 100:
                return 429
            if con.execute("select count(*) from missions where status in ('queued','running','stopping')").fetchone()[0] >= 10:
                return 429
            now = time.time()
            try:
                con.execute("insert into missions(id,workspace_id,organization_id,created_by,prompt,status,created_at,updated_at) values(?,?,?,?,?,'queued',?,?)", (mission_id, self.workspace, self.organization, user_id, prompt, now, now))
            except sqlite3.IntegrityError:
                # Another handler admitted the same UUID while pricing was checked.
                existing = con.execute("select prompt,created_by from missions where id=?", (mission_id,)).fetchone()
                return 200 if existing and existing["prompt"] == prompt and existing["created_by"] == user_id else 409
        self.wake.set()
        return 202

    def stop(self, mission_id):
        mission_id = uuid(mission_id)
        with self.lock, self.db() as con:
            if not con.execute("select 1 from missions where id=? and workspace_id=? and organization_id=?", (mission_id, self.workspace, self.organization)).fetchone():
                return False
            con.execute("update missions set status=case when status='queued' then 'stopped' else 'stopping' end,updated_at=? where id=? and workspace_id=? and status in ('queued','running')", (time.time(), mission_id, self.workspace))
            for value in self.active.values():
                if value["id"] == mission_id:
                    value["cancelled"] = True
        self.wake.set()
        return True

    def completion(self, token, body):
        try:
            return self._completion(token, body)
        except Exception as error:
            with self.lock:
                active = self.active.get(token)
                if active is not None:
                    active.setdefault("rejection", (type(error).__name__ + ": " + str(error)).replace(token, "[REDACTED]").replace(self.upstream_key, "[REDACTED]")[:500])
            raise

    def _completion(self, token, body):
        with self.lock:
            active = self.active.get(token)
            if not active or active["cancelled"] or time.time() > active["expires"] or active["calls"] >= 1:
                raise PolicyError("Autorisation temporaire expirée ou épuisée.")
            active["calls"] += 1
        clean = safe_completion(body)
        self.fresh_policy()
        request = Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(clean).encode(), headers={"Authorization": "Bearer " + self.upstream_key, "Content-Type": "application/json", "User-Agent": "Optivos-zero-fee-pilot/1"}, method="POST")
        try:
            with self.opener.open(request, timeout=35) as response:
                raw = response.read(262145)
        except HTTPError as error:
            active["rejection"] = "provider-http-" + str(error.code)
            raise
        result = None
        try:
            if len(raw) > 262144:
                raise PolicyError("Réponse trop volumineuse ; coût non vérifiable.")
            try:
                result = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                raise PolicyError("Réponse illisible ; coût non vérifiable.") from None
            proof = verified_usage(result)
        except PolicyError as error:
            with self.lock, self.db() as con:
                self.suspended = True
                con.execute("insert or replace into pilot_state values('suspended','unverified-response')")
                active["rejection"] = str(error)
            # Persist suspension before optional operator-only diagnostic writing.
            diagnostic = {"error": str(error), "model": result.get("model") if isinstance(result, dict) else None, "usage": result.get("usage") if isinstance(result, dict) else None}
            file = self.path.parent / (active["id"] + ".financial-diagnostic.json")
            try:
                descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                with os.fdopen(descriptor, "w") as output:
                    json.dump(diagnostic, output)
            except OSError:
                pass
            raise
        with self.lock:
            active["usage"].append(proof)
            choices = result.get("choices") or []
            choice = choices[0] if choices else {}
            message = choice.get("message") or {}
            text = message.get("content")
            if choice.get("finish_reason") != "stop" or not isinstance(text, str) or not text.strip():
                active["cancelled"] = True
                raise PolicyError("Réponse incomplète ; continuation automatique interdite.")
            active["answer"] = text.strip()
        return result

    def execute(self, row):
        token = secrets.token_hex(32)
        entry = {"id": row["id"], "expires": time.time() + 80, "calls": 0, "usage": [], "cancelled": False}
        with self.lock, self.db() as con:
            if con.execute("select status from missions where id=?", (row["id"],)).fetchone()[0] != "running":
                con.execute("update missions set status='stopped',updated_at=? where id=? and status='stopping'", (time.time(), row["id"]))
                return
            self.active[token] = entry
        command = ["docker", "exec", "-i", "--user", "65534:65534", "hermes", "env", "-i", "PATH=/usr/bin:/bin", "/opt/hermes/.venv/bin/python", "/opt/optivos-free-pilot/worker.py"]
        payload = {"brokerUrl": "http://172.16.1.1:18647/v1", "token": token, "prompt": row["prompt"]}
        output, proof, error = None, None, None
        run = None
        try:
            run = subprocess.run(command, input=json.dumps(payload), text=True, capture_output=True, timeout=85)
            lines = [line.removeprefix("OPTIVOS_RESULT:") for line in run.stdout.splitlines() if line.startswith("OPTIVOS_RESULT:")]
            if run.returncode or len(lines) != 1 or not entry["usage"] or entry["calls"] != len(entry["usage"]):
                raise RuntimeError("Hermes worker failed or returned no verified completion")
            result = json.loads(lines[0])
            isolation = result["isolation"]
            if isolation["tools"] != 0 or isolation["fallbacks"] != 0 or not isolation["privateBroker"] or isolation["nativeCredentialsReadable"] or isolation["uid"] != 65534 or not isolation.get("streamingDisabled"):
                raise RuntimeError("Isolation attestation failed")
            output = result["text"]
            if not isinstance(output, str) or not output.strip() or len(output) > 12000:
                raise RuntimeError("Invalid worker output")
            if output.strip() != entry.get("answer"):
                raise RuntimeError("Final answer does not match a verified provider response")
            proof = {"model": entry["usage"][-1]["model"], "verifiedApiCostUsd": "0", "llmRequests": entry["calls"], "verifiedResponses": len(entry["usage"]), "tools": 0, "fallbacks": 0, "runtime": "Hermes AIAgent", "usage": entry["usage"]}
        except Exception as exc:
            error = "Le pilote gratuit n'a pas produit de résultat vérifié. Aucun repli payant ni rejeu automatique."
            diagnostic = {"type": type(exc).__name__, "workerExitCode": run.returncode if run else None,
                          "requests": entry["calls"], "verifiedResponses": len(entry["usage"]), "rejection": entry.get("rejection"),
                          "workerStderr": run.stderr.replace(token, "[REDACTED]").replace(self.upstream_key, "[REDACTED]")[-8000:] if run else None,
                          "workerStdout": run.stdout.replace(token, "[REDACTED]").replace(self.upstream_key, "[REDACTED]")[-8000:] if run else None}
            file = self.path.parent / (row["id"] + ".worker-diagnostic.json")
            descriptor = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(descriptor, "w") as output_file:
                json.dump(diagnostic, output_file)
        finally:
            with self.lock, self.db() as con:
                self.active.pop(token, None)
                current = con.execute("select status from missions where id=?", (row["id"],)).fetchone()
                status = "stopped" if current["status"] == "stopping" else "failed" if error else "completed"
                if status == "stopped":
                    error = None
                con.execute("update missions set status=?,output=?,error=?,proof=?,updated_at=? where id=?", (status, output, error, json.dumps(proof) if proof else None, time.time(), row["id"]))

    def worker_loop(self):
        while not self.closing.is_set():
            with self.lock, self.db() as con:
                row = con.execute("select * from missions where status='queued' and workspace_id=? and organization_id=? order by created_at,id limit 1", (self.workspace, self.organization)).fetchone()
                if row:
                    con.execute("update missions set status='running',updated_at=? where id=?", (time.time(), row["id"]))
            if row:
                self.execute(dict(row))
            else:
                self.wake.wait(2)
                self.wake.clear()


def handler(pilot, broker=False):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, *_):
            pass

        def send(self, status, value):
            raw = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "private, no-store")
            self.end_headers()
            self.wfile.write(raw)

        def dispatch(self):
            auth = self.headers.get("Authorization", "")
            token = auth.removeprefix("Bearer ") if auth.startswith("Bearer ") else ""
            if not broker and (not hmac.compare_digest(token, pilot.gateway_key) or self.headers.get("X-Optivos-Workspace-Id") != pilot.workspace):
                return self.send(404, {"error": "Not found"})
            if "?" in self.path:
                return self.send(404, {"error": "Not found"})
            body = None
            if self.command == "POST":
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= (131072 if broker else 8192):
                    return self.send(413, {"error": "Body rejected"})
                body = json.loads(self.rfile.read(size))
            if broker:
                if self.path != "/v1/chat/completions" or self.command != "POST":
                    return self.send(404, {"error": "Not found"})
                return self.send(200, pilot.completion(token, body))
            if self.command == "GET" and self.path == "/pilot/readiness":
                return self.send(200, {"state": "ready", "policy": pilot.fresh_policy(), "toolsAllowed": 0, "fallbackAllowed": False})
            if self.path == "/pilot/missions":
                if self.command == "GET":
                    return self.send(200, pilot.listing())
                if self.command == "POST":
                    code = pilot.create(body)
                    return self.send(code, {"data": pilot.listing(body["id"])["items"][0]} if code in (200, 202) else {"error": "Mission refused"})
            if self.path.startswith("/pilot/missions/"):
                tail = self.path.removeprefix("/pilot/missions/")
                if self.command == "POST" and tail.endswith("/review"):
                    mission_id = uuid(tail.removesuffix("/review"))
                    code = pilot.review(mission_id, body)
                    return self.send(code, {"data": pilot.listing(mission_id)["items"][0]} if code == 200 else {"error": "Review refused"})
                if self.command == "POST" and tail.endswith("/stop") and body == {}:
                    if not pilot.stop(tail.removesuffix("/stop")):
                        return self.send(404, {"error": "Not found"})
                    return self.send(200, {"stopping": True})
                if self.command == "GET":
                    items = pilot.listing(uuid(tail))["items"]
                    return self.send(200 if items else 404, {"data": items[0]} if items else {"error": "Not found"})
            self.send(404, {"error": "Not found"})

        def do_GET(self):
            try:
                self.dispatch()
            except (ValueError, KeyError, TypeError):
                self.send(400, {"error": "Invalid request"})
            except Exception:
                self.send(400 if broker else 503, {"error": "Free pilot unavailable; no paid fallback or automatic retry"})

        do_POST = do_GET
    return Handler


def main():
    pilot = Pilot(Path("/var/lib/optivos-hermes-pilot/missions.sqlite3"), os.environ["OPTIVOS_WORKSPACE_ID"], os.environ["OPTIVOS_ORGANIZATION_ID"], os.environ["OPTIVOS_PILOT_KEY"], os.environ["OPENROUTER_API_KEY"])
    servers = [ThreadingHTTPServer(("127.0.0.1", 18646), handler(pilot)), ThreadingHTTPServer(("172.16.1.1", 18647), handler(pilot, broker=True))]
    for server in servers:
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()
    threading.Thread(target=pilot.worker_loop, daemon=True).start()
    try:
        threading.Event().wait()
    finally:
        pilot.closing.set()
        for server in servers:
            server.shutdown()


if __name__ == "__main__":
    main()
