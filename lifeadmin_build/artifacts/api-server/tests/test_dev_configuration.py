"""Exercise the real development launcher with synthetic configuration only."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


LAUNCHER = Path(__file__).resolve().parents[3] / 'scripts' / 'dev_api.mjs'


class DevConfigurationTests(unittest.TestCase):
    def run_launcher(self, local=None, inherited=None, app=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            server = root / 'artifacts' / 'api-server'
            server.mkdir(parents=True)
            shutil.copyfile(LAUNCHER, root / 'scripts' / 'dev_api.mjs')
            if local is not None:
                (root / '.env').write_text(local, encoding='utf-8')
            (server / 'app.py').write_text(app or (
                'import json, os\n'
                'print(json.dumps({key: os.environ.get(key) for key in '
                '["SMTP_PASSWORD", "SMTP_PORT", "SMTP_SECURITY", '
                '"PASSWORD_RECOVERY_ENABLED", "DEV_LITERAL"]}))\n'
            ), encoding='utf-8')
            environment = {
                key: value for key, value in os.environ.items()
                if not key.startswith(('SMTP_', 'PASSWORD_RECOVERY_', 'DEV_LITERAL'))
            }
            environment.update(inherited or {})
            result = subprocess.run(
                ['node', str(root / 'scripts' / 'dev_api.mjs')],
                cwd=directory, env=environment, text=True,
                capture_output=True, timeout=10,
            )
            return result, (root / 'executed').exists()

    def test_inherited_settings_survive_blank_or_conflicting_file(self):
        result, _ = self.run_launcher(
            'SMTP_PASSWORD=\nSMTP_PORT=465\nSMTP_SECURITY=ssl\n'
            'PASSWORD_RECOVERY_ENABLED=true\n',
            {'SMTP_PASSWORD': 'synthetic-secret', 'SMTP_PORT': '587',
             'SMTP_SECURITY': 'starttls', 'PASSWORD_RECOVERY_ENABLED': 'false'},
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {
            'SMTP_PASSWORD': 'synthetic-secret', 'SMTP_PORT': '587',
            'SMTP_SECURITY': 'starttls', 'PASSWORD_RECOVERY_ENABLED': 'false',
            'DEV_LITERAL': None,
        })

    def test_local_file_supplies_missing_values(self):
        result, _ = self.run_launcher(
            'SMTP_PORT=587\nSMTP_SECURITY=starttls\nPASSWORD_RECOVERY_ENABLED=false\n'
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        values = json.loads(result.stdout)
        self.assertEqual(values['SMTP_PORT'], '587')
        self.assertEqual(values['SMTP_SECURITY'], 'starttls')
        self.assertEqual(values['PASSWORD_RECOVERY_ENABLED'], 'false')

    def test_explicit_empty_environment_is_not_replaced(self):
        result, _ = self.run_launcher('SMTP_PASSWORD=local-value\n', {'SMTP_PASSWORD': ''})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['SMTP_PASSWORD'], '')

    def test_missing_local_file_is_optional(self):
        result, _ = self.run_launcher(inherited={'PASSWORD_RECOVERY_ENABLED': 'false'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['PASSWORD_RECOVERY_ENABLED'], 'false')

    def test_shell_substitution_is_literal_data(self):
        result, executed = self.run_launcher('DEV_LITERAL="$(touch executed) `touch executed`"\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(executed)
        self.assertEqual(json.loads(result.stdout)['DEV_LITERAL'], '$(touch executed) `touch executed`')

    def test_api_failure_exit_code_is_preserved(self):
        result, _ = self.run_launcher(app='raise SystemExit(7)\n')
        self.assertEqual(result.returncode, 7)


if __name__ == '__main__':
    unittest.main()
