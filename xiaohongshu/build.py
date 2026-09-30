"""Build the offline Xiaohongshu mini-tool zip from src/."""

from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import re


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
BUILD = ROOT / "build"
DIST = ROOT / "dist"
ZIP = DIST / "renewal-ledger-xhs-v2.zip"


class PackageHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.bad = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            if not attrs.get("src"):
                self.bad.append("inline script")
            else:
                self.scripts.append(attrs["src"])
        if tag in {"iframe", "object", "embed"}:
            self.bad.append(tag)
        if tag == "a" and ("download" in attrs or attrs.get("target") == "_blank"):
            self.bad.append("download or external link")
        if any(key.lower().startswith("on") for key in attrs):
            self.bad.append("inline event handler")


def validate(package):
    names = sorted(package)
    assert names == ["app.js", "backup.js", "index.html"], names
    html = package["index.html"].decode("utf-8")
    parser = PackageHTML()
    parser.feed(html)
    assert not parser.bad, parser.bad
    assert parser.scripts == ["./backup.js", "./app.js"], parser.scripts
    assert "<style>" in html and "</style>" in html
    assert not re.search(r"https?://|@import\b|url\(\s*['\"]?https?://", html, re.I)
    for name in ("app.js", "backup.js"):
        js = package[name].decode("utf-8")
        forbidden = [
            r"\bfetch\s*\(", r"\bXMLHttpRequest\b", r"\bWebSocket\b",
            r"\bserviceWorker\b", r"\beval\s*\(", r"\bnew\s+Function\s*\(",
            r"\?\.", r"\?\?", r"\.replaceAll\s*\(", r"\.text\s*\(",
        ]
        assert not any(re.search(rule, js) for rule in forbidden), f"forbidden capability in {name}"
    assert b":is(" not in html.encode("utf-8")


def main():
    html = (SOURCE / "index.html").read_text(encoding="utf-8")
    css = (SOURCE / "styles.css").read_text(encoding="utf-8")
    stylesheet = '<link rel="stylesheet" href="styles.css">'
    assert html.count(stylesheet) == 1
    html = html.replace(stylesheet, "<style>\n" + css + "\n</style>")
    package = {
        "index.html": html.encode("utf-8"),
        "backup.js": (SOURCE / "backup.js").read_bytes(),
        "app.js": (SOURCE / "app.js").read_bytes(),
    }
    validate(package)
    BUILD.mkdir(exist_ok=True)
    DIST.mkdir(exist_ok=True)
    for name, content in package.items():
        (BUILD / name).write_bytes(content)
    with ZipFile(ZIP, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(package):
            archive.writestr(name, package[name])
    with ZipFile(ZIP) as archive:
        assert archive.namelist() == sorted(package)
        assert archive.testzip() is None
    print(f"package: {ZIP}")
    print(f"files: {', '.join(sorted(package))}")
    print(f"bytes: {ZIP.stat().st_size}")
    print(f"sha256: {sha256(ZIP.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
