import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('list_projects', Path(__file__).with_name('list-projects.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ListProjectsTest(unittest.TestCase):
    def test_only_active_existing_folders_are_listed(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            (home / 'userdata').mkdir()
            root = home / 'project'
            root.mkdir()
            with sqlite3.connect(home / 'userdata' / 'statev2.sqlite') as db:
                db.execute('CREATE TABLE projection_projects(title,workspace_root,deleted_at,archived_at)')
                db.executemany('INSERT INTO projection_projects VALUES (?,?,?,?)', [
                    ('Active', str(root), None, None), ('Deleted', str(root), 'date', None),
                    ('Archived', str(root), None, 'date'), ('Missing', '/missing-folder', None, None)
                ])
            self.assertEqual(module.list_projects(home), [{'title': 'Active', 'root': str(root)}])


if __name__ == '__main__':
    unittest.main()
