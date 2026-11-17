"""Read active T3 projects without changing T3's local database."""
import json
import os
from pathlib import Path
import sqlite3


def list_projects(home):
    database = Path(home) / 'userdata' / 'statev2.sqlite'
    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=3) as connection:
        rows = connection.execute('''
            SELECT title, workspace_root FROM projection_projects
            WHERE deleted_at IS NULL AND archived_at IS NULL
            ORDER BY title COLLATE NOCASE
        ''').fetchall()
    return [{'title': title, 'root': root} for title, root in rows if Path(root).is_dir()]


if __name__ == '__main__':
    print(json.dumps(list_projects(os.environ.get('T3CODE_HOME', str(Path.home() / '.t3'))), ensure_ascii=False))
