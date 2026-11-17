import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


class BackupTest(unittest.TestCase):
    def test_changes_retry_and_remote_conflict(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            remote, repo = base / 'remote.git', base / 'repo'
            env = {**os.environ, 'XDG_RUNTIME_DIR': str(base)}

            def git(*args, cwd=repo, check=True):
                return subprocess.run(['git', *args], cwd=cwd, env=env, check=check,
                                      capture_output=True, text=True)

            git('init', '--bare', str(remote), cwd=base)
            repo.mkdir()
            git('init', '-b', 'main')
            git('config', 'user.email', 'backup-test@example.invalid')
            git('config', 'user.name', 'Backup Test')
            (repo / 'scripts').mkdir()
            script = repo / 'scripts/sync-lucasvim.sh'
            shutil.copyfile(Path(__file__).with_name('sync-lucasvim.sh'), script)
            (repo / '.gitignore').write_text('private.env\n')
            git('add', '.')
            git('commit', '-m', 'Initial configuration')
            git('remote', 'add', 'origin', str(remote))
            git('push', '-u', 'origin', 'main')

            def sync(check=True):
                return subprocess.run(['bash', str(script)], cwd=repo, env=env,
                                      check=check, capture_output=True, text=True)

            def remote_head():
                return git('rev-parse', 'refs/heads/main', cwd=remote).stdout

            (repo / 'setting').write_text('one\n')
            (repo / 'private.env').write_text('local only\n')
            sync()
            self.assertEqual(git('rev-parse', 'HEAD').stdout, remote_head())
            self.assertNotIn('private.env', git('ls-files').stdout.splitlines())
            previous = remote_head()
            sync()
            self.assertEqual(previous, remote_head())

            git('remote', 'set-url', 'origin', str(base / 'unavailable.git'))
            (repo / 'setting').write_text('two\n')
            self.assertNotEqual(sync(check=False).returncode, 0)
            self.assertEqual(git('status', '--porcelain').stdout, '')
            git('remote', 'set-url', 'origin', str(remote))
            sync()
            self.assertEqual(git('rev-parse', 'HEAD').stdout, remote_head())

            (repo / '.git/MERGE_HEAD').write_text(git('rev-parse', 'HEAD').stdout)
            (repo / 'setting').write_text('three\n')
            self.assertNotEqual(sync(check=False).returncode, 0)
            self.assertEqual(git('status', '--porcelain').stdout.strip(), 'M setting')
            (repo / '.git/MERGE_HEAD').unlink()
            sync()

            other = base / 'other'
            git('clone', '-b', 'main', str(remote), str(other), cwd=base)
            git('config', 'user.email', 'backup-test@example.invalid', cwd=other)
            git('config', 'user.name', 'Backup Test', cwd=other)
            (other / 'setting').write_text('remote change\n')
            git('add', '.', cwd=other)
            git('commit', '-m', 'Other machine', cwd=other)
            git('push', cwd=other)
            remote_before = remote_head()
            local_before = git('rev-parse', 'HEAD').stdout
            self.assertNotEqual(sync(check=False).returncode, 0)
            self.assertEqual(remote_head(), remote_before)
            self.assertEqual(git('rev-parse', 'HEAD').stdout, local_before)
            self.assertEqual((repo / 'setting').read_text(), 'three\n')


if __name__ == '__main__':
    unittest.main()
