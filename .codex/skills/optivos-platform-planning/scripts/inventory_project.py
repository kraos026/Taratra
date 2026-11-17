"""Local tracked-file inventory; no network, model calls or secret-file reads."""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import subprocess


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def inventory(root):
    resolved = Path(git(root, "rev-parse", "--show-toplevel")).resolve()
    if resolved != root.resolve():
        raise ValueError("--root must be the repository root")
    files = git(root, "ls-files", "src/modules", "src/app/api", "docs/architecture", ".codex/skills").splitlines()
    modules = defaultdict(Counter)
    routes = []
    for name in files:
        parts = name.split("/")
        if name.startswith("src/modules/") and len(parts) > 3:
            modules[parts[2]][parts[3] if len(parts) > 4 else "root"] += 1
        if name.startswith("src/app/api/") and name.endswith("/route.ts"):
            routes.append(name)
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    dependencies = {**package.get("devDependencies", {}), **package.get("dependencies", {})}
    return {
        "kind": "tracked-files-only; not runtime or security certification",
        "commit": git(root, "rev-parse", "HEAD"),
        "branch": git(root, "branch", "--show-current"),
        "dirty": bool(git(root, "status", "--porcelain")),
        "moduleCount": len(modules),
        "apiRouteCount": len(routes),
        "modules": {name: dict(sorted(counts.items())) for name, counts in sorted(modules.items())},
        "selectedDependencies": {name: dependencies.get(name) for name in ["next", "react", "typescript", "@supabase/ssr", "@prisma/client", "@xyflow/react", "rete", "rete-engine"]},
        "nodalInstalledInManifest": any(name in dependencies for name in ["@xyflow/react", "rete", "rete-engine"]),
        "projectSkills": sorted(name for name in files if name.startswith(".codex/skills/") and name.endswith("/SKILL.md")),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[4])
    args = parser.parse_args()
    try:
        result = inventory(args.root)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(2, f"Inventory unavailable: {error.__class__.__name__}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
