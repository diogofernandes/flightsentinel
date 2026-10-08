from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parents[1] / '.publicsite'), **kwargs)
    def do_GET(self):
        if self.path.startswith('/flightsentinel/'):
            self.path = self.path[len('/flightsentinel'):]
        super().do_GET()
ThreadingHTTPServer(('127.0.0.1', 8092), Handler).serve_forever()
