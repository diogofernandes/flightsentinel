"""Build and publish the labelled React replay to this repository's Pages branch."""
import os
import sys
from pathlib import Path
import shutil
import subprocess
import tempfile
root = Path(__file__).resolve().parents[1]
remote = "https://github.com/diogofernandes/flightsentinel.git"
def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)
def git(args, cwd):
    return run(["git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", *args], cwd=cwd)
env = {**os.environ, "VITE_DEMO_MODE": "replay"}
run(["npm", "run", "build", "--", "--base=/flightsentinel/"], cwd=root / "frontend", env=env)
run([sys.executable, "scripts/package-public.py"], cwd=root)
with tempfile.TemporaryDirectory(prefix="flightsentinel-pages-") as location:
    staging = Path(location)
    git(["init", "-b", "gh-pages"], staging)
    git(["remote", "add", "origin", remote], staging)
    refs = subprocess.check_output(["git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", "ls-remote", "--heads", "origin", "gh-pages"], cwd=staging, text=True)
    if refs.strip():
        git(["fetch", "origin", "gh-pages"], staging)
        git(["checkout", "-B", "gh-pages", "FETCH_HEAD"], staging)
    shutil.copytree(root / ".publicsite", staging, dirs_exist_ok=True)
    git(["add", "."], staging)
    changed = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=staging).returncode
    if changed:
        git(["commit", "-m", "Publish FlightSentinel dashboard and recruiter explanation"], staging)
        git(["push", "origin", "HEAD:gh-pages"], staging)
print("Published branch. CV URL: https://diogofernandes.github.io/flightsentinel/")
