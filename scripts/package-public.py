"""Package the same React dashboard in explicit recorded-replay mode for Pages."""
import shutil
from pathlib import Path
root = Path(__file__).resolve().parents[1]
out = root / '.publicsite'
out.mkdir(exist_ok=True)
shutil.copytree(root / 'frontend/dist', out, dirs_exist_ok=True)
shutil.copytree(root / 'docs', out / 'project', dirs_exist_ok=True)
for name in ['index.html', 'about.html']:
    p = out / 'project' / name
    p.write_text(p.read_text().replace('href="/"', 'href="/flightsentinel/"').replace('Live dashboard', 'Dashboard demo'))
(out / '.nojekyll').touch()
print(out)
