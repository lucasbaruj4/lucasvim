#!/usr/bin/env python3
"""Send a local Codex file link to the VS Code window on Windows."""

import base64
import json
import os
from pathlib import Path
import subprocess
import sys


def main() -> int:
    if len(sys.argv) not in (2, 4):
        return 2

    path = Path(sys.argv[1])
    distro = os.environ.get("WSL_DISTRO_NAME")
    code = Path("/mnt/c/Users/Admin/AppData/Local/Programs/Microsoft VS Code/Code.exe")
    if not distro or not path.is_absolute() or not path.is_file() or not code.is_file():
        return 1

    arguments = {"distro": distro, "path": str(path)}
    if len(sys.argv) == 4:
        arguments.update(line=sys.argv[2], column=sys.argv[3])
    payload = base64.urlsafe_b64encode(json.dumps(arguments).encode()).decode().rstrip("=")
    uri = "vscode://lucas.t3-toggle/open-file?" + payload
    subprocess.Popen(
        [str(code), "--open-url", uri],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
