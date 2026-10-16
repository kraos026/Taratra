"""Short-lived unprivileged Hermes worker; never receives an upstream paid credential."""
import json
import fcntl
import os
from pathlib import Path
import signal
import shutil
import sys
import tempfile
from policy import MODEL


def main():
    if os.getuid() != 65534:
        raise RuntimeError("Unprivileged worker required")
    signal.signal(signal.SIGALRM, lambda *_: os._exit(124))
    signal.alarm(70)
    lock = os.open("/tmp/optivos-hermes-pilot.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    if os.fstat(lock).st_uid != 65534:
        raise RuntimeError("Unexpected worker lock owner")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    raw = sys.stdin.buffer.read(32769)
    if len(raw) > 32768:
        raise RuntimeError("Worker input exceeds limit")
    request = json.loads(raw)
    home = Path(tempfile.mkdtemp(prefix="optivos-hermes-"))
    os.environ.update(HOME=str(home), HERMES_HOME=str(home), XDG_CONFIG_HOME=str(home))
    (home / ".env").write_text("")
    (home / "config.yaml").write_text(f"model:\n  default: {MODEL}\n  streaming: false\nfallback_providers: []\n")
    os.chdir(home)
    sys.path.insert(0, "/opt/hermes")
    from run_agent import AIAgent
    base = request["brokerUrl"]
    if base != "http://172.16.1.1:18647/v1":
        raise RuntimeError("Unexpected private broker origin")
    agent = AIAgent(
        base_url=base, api_key=request["token"], provider="custom",
        model=MODEL, max_iterations=1, max_tokens=1536,
        enabled_toolsets=[], fallback_model=[], skip_memory=True,
        skip_background_review=True, skip_context_files=True, load_soul_identity=False,
        save_trajectories=False, quiet_mode=True, verbose_logging=False,
        checkpoints_enabled=False, run_budget_seconds=60, side_agent=True,
    )
    try:
        proof = {"tools": len(agent.tools or []), "fallbacks": len(agent._fallback_chain),
                 "privateBroker": agent.base_url.rstrip("/") == base,
                 "nativeCredentialsReadable": os.access("/opt/data/.env", os.R_OK), "uid": os.getuid(),
                 "streamingDisabled": agent._disable_streaming is True, "singleWorkerLock": True}
        if proof["tools"] or proof["fallbacks"] or not proof["privateBroker"] or proof["nativeCredentialsReadable"] or not proof["streamingDisabled"]:
            raise RuntimeError("Isolation attestation failed; no inference allowed")
        print("OPTIVOS_ATTEST:" + json.dumps(proof), flush=True)
        if request.get("attestOnly"):
            return
        result = agent.run_conversation(request["prompt"])
        answer = result.get("final_response") if isinstance(result, dict) else None
        if not isinstance(answer, str) or not answer.strip():
            raise RuntimeError("Hermes did not produce a final answer")
        print("OPTIVOS_RESULT:" + json.dumps({"text": answer[:12000], "isolation": proof}), flush=True)
    finally:
        try:
            agent.close()
        finally:
            if home.resolve().parent == Path(tempfile.gettempdir()).resolve() and home.name.startswith("optivos-hermes-"):
                shutil.rmtree(home, ignore_errors=True)


if __name__ == "__main__":
    main()
