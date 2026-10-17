import { spawn } from 'node:child_process';
import { loadEnvFile } from 'node:process';

// Inherited settings take precedence, including explicitly empty values.
// Parse local configuration as data; never execute it as shell code.
try {
  loadEnvFile(new URL('../.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Unable to read local API configuration.');
    process.exit(1);
  }
}

const api = spawn('python', ['app.py'], {
  cwd: new URL('../artifacts/api-server/', import.meta.url),
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => api.kill(signal));
}
api.on('error', () => {
  console.error('Unable to start the API. Check the Python installation.');
  process.exitCode = 1;
});
api.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143);
});
