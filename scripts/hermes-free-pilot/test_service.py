import json
import io
from pathlib import Path
import tempfile
import time
import unittest
import subprocess
import threading
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch
from uuid import uuid4
from policy import MODEL, PolicyError
from service import Pilot, handler


class DurablePilotTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / "missions.sqlite3"
        self.workspace, self.organization, self.user = (str(uuid4()) for _ in range(3))
        self.pilot = Pilot(self.path, self.workspace, self.organization, "gate", "upstream")
        self.pilot.fresh_policy = lambda: {"model": MODEL}
        self.body = {"id": str(uuid4()), "prompt": "Préparer cinq étapes d’accueil client", "userId": self.user}

    def tearDown(self):
        self.folder.cleanup()

    def test_persistent_idempotency_replays_without_requeue_or_overwrite(self):
        self.assertEqual(self.pilot.create(self.body), 202)
        self.assertEqual(self.pilot.create(self.body), 200)
        self.assertEqual(self.pilot.create({**self.body, "prompt": "Une autre mission différente"}), 409)
        self.assertEqual(self.pilot.create({**self.body, "userId": str(uuid4())}), 409)
        restarted = Pilot(self.path, self.workspace, self.organization, "gate", "upstream")
        self.assertEqual(restarted.create(self.body), 200)
        self.assertEqual(len(restarted.listing()["items"]), 1)

    def test_unverified_prices_do_not_admit_job(self):
        def denied():
            raise PolicyError("paid")
        self.pilot.fresh_policy = denied
        with self.assertRaises(PolicyError):
            self.pilot.create(self.body)
        self.assertEqual(self.pilot.listing()["items"], [])

    def test_rebinding_persisted_tenant_is_refused(self):
        with self.assertRaises(RuntimeError):
            Pilot(self.path, str(uuid4()), self.organization, "gate", "upstream")

    def test_restart_does_not_replay_interrupted_runs(self):
        self.pilot.create(self.body)
        with self.pilot.db() as con:
            con.execute("update missions set status='running'")
        restarted = Pilot(self.path, self.workspace, self.organization, "gate", "upstream")
        self.assertEqual(restarted.listing()["items"][0]["status"], "interrupted")
        self.assertEqual(restarted.create(self.body), 200)

    def test_stop_queued_and_running_prevents_new_inference(self):
        self.pilot.create(self.body)
        self.pilot.stop(self.body["id"])
        self.assertEqual(self.pilot.listing()["items"][0]["status"], "stopped")
        self.pilot.active["temporary"] = {"id": self.body["id"], "cancelled": False, "expires": time.time()+20, "calls": 0, "usage": []}
        self.pilot.stop(self.body["id"])
        with self.assertRaises(PolicyError):
            self.pilot.completion("temporary", {})

    def test_bad_or_exhausted_token_never_reaches_provider(self):
        self.pilot.active["exhausted"] = {"cancelled": False, "expires": time.time()+20, "calls": 1}
        with patch.object(self.pilot.opener, "open") as network:
            for token in ["unknown", "exhausted"]:
                with self.assertRaises(PolicyError):
                    self.pilot.completion(token, {})
            network.assert_not_called()

    def test_http_requires_matching_workspace_even_with_valid_control_key(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler(self.pilot))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = "http://127.0.0.1:"+str(server.server_address[1])+"/pilot/readiness"
            for workspace in [None, str(uuid4())]:
                headers = {"Authorization": "Bearer gate"}
                if workspace:
                    headers["X-Optivos-Workspace-Id"] = workspace
                with self.assertRaises(HTTPError) as caught:
                    urlopen(Request(url, headers=headers), timeout=3)
                self.assertEqual(caught.exception.code, 404)
            with urlopen(Request(url, headers={"Authorization": "Bearer gate", "X-Optivos-Workspace-Id": self.workspace}), timeout=3) as response:
                self.assertEqual(response.status, 200)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_nonzero_response_cost_suspends_future_calls_persistently(self):
        self.pilot.active["one"] = {"id": str(uuid4()), "cancelled": False, "expires": time.time()+20, "calls": 0, "usage": []}
        response = {"model": MODEL, "usage": {"cost": "0.01"}}
        with patch.object(self.pilot.opener, "open", return_value=io.BytesIO(json.dumps(response).encode())):
            with self.assertRaises(PolicyError):
                self.pilot.completion("one", {"model": MODEL, "messages": [{"role": "user", "content": "hello"}]})
        restarted = Pilot(self.path, self.workspace, self.organization, "gate", "upstream")
        with self.assertRaises(PolicyError):
            restarted.fresh_policy()

    def test_harness_error_cannot_be_reported_as_completed_model_output(self):
        self.pilot.create(self.body)
        with self.pilot.db() as con:
            con.execute("update missions set status='running'")
            row = dict(con.execute("select * from missions").fetchone())
        def run(command, *, input, **kwargs):
            entry = self.pilot.active[json.loads(input)["token"]]
            entry.update(calls=1, usage=[{"model": MODEL, "costUsd": "0"}], answer="Actual provider output")
            result = {"text": "Harness-generated error string", "isolation": {"tools": 0, "fallbacks": 0, "privateBroker": True, "nativeCredentialsReadable": False, "uid": 65534, "streamingDisabled": True}}
            return subprocess.CompletedProcess(command, 0, "OPTIVOS_RESULT:"+json.dumps(result), "")
        with patch("service.subprocess.run", side_effect=run):
            self.pilot.execute(row)
        self.assertEqual(self.pilot.listing()["items"][0]["status"], "failed")

    def test_truncated_response_blocks_continuation_without_extra_provider_call(self):
        self.pilot.active["one"] = {"id": str(uuid4()), "cancelled": False, "expires": time.time()+20, "calls": 0, "usage": []}
        response = {"model": MODEL, "usage": {"cost": 0}, "choices": [{"finish_reason": "length", "message": {"content": "Incomplete answer"}}]}
        with patch.object(self.pilot.opener, "open", return_value=io.BytesIO(json.dumps(response).encode())) as network:
            for _ in range(2):
                with self.assertRaises(PolicyError):
                    self.pilot.completion("one", {"model": MODEL, "messages": [{"role": "user", "content": "hello"}]})
            self.assertEqual(network.call_count, 1)

    def test_accepted_unreadable_response_also_suspends_financial_admission(self):
        self.pilot.active["one"] = {"id": str(uuid4()), "cancelled": False, "expires": time.time()+20, "calls": 0, "usage": []}
        with patch.object(self.pilot.opener, "open", return_value=io.BytesIO(b"not-json")):
            with self.assertRaises(PolicyError):
                self.pilot.completion("one", {"model": MODEL, "messages": [{"role": "user", "content": "hello"}]})
        restarted = Pilot(self.path, self.workspace, self.organization, "gate", "upstream")
        with self.assertRaises(PolicyError):
            restarted.fresh_policy()


if __name__ == "__main__":
    unittest.main()
