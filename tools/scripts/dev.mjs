import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const projectId = 'maresia-grill-local';
const appOrigin = 'http://127.0.0.1:5173';
const functionsBaseUrl = `http://127.0.0.1:5001/${projectId}/us-central1`;
const webhookForwardUrl = `${functionsBaseUrl}/paymentWebhook`;

const rootEnvPath = path.join(repoRoot, '.env.local');
const functionsEnvPath = path.join(repoRoot, 'apps', 'functions', '.env.local');

const processes = [];
let shuttingDown = false;
const firebaseCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const requiredPorts = [
  { port: 4000, label: 'Emulator UI' },
  { port: 5001, label: 'Functions emulator' },
  { port: 5173, label: 'Vite' },
  { port: 8180, label: 'Firestore emulator' },
  { port: 9099, label: 'Auth emulator' },
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (label, message) => {
  process.stdout.write(`[${label}] ${message}\n`);
};

const logError = (label, message) => {
  process.stderr.write(`[${label}] ${message}\n`);
};

const parseEnv = (contents) => {
  const entries = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    entries.set(match[1], match[2]);
  }
  return entries;
};

const mergeEnvFile = (filePath, defaults, forced = {}) => {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const values = parseEnv(existing);

  for (const [key, value] of Object.entries(defaults)) {
    if (!values.has(key)) values.set(key, value);
  }

  for (const [key, value] of Object.entries(forced)) {
    values.set(key, value);
  }

  const next = `${Array.from(values.entries()).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
  if (next !== existing) fs.writeFileSync(filePath, next, 'utf8');
  return values;
};

const updateEnvValue = (filePath, key, value) => {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const values = parseEnv(existing);
  if (values.get(key) === value) return;
  values.set(key, value);
  const next = `${Array.from(values.entries()).map(([entryKey, entryValue]) => `${entryKey}=${entryValue}`).join('\n')}\n`;
  fs.writeFileSync(filePath, next, 'utf8');
};

const commandExists = async (command) => new Promise((resolve) => {
  const child = spawn(command, ['--version'], { stdio: 'ignore' });
  child.on('error', () => resolve(false));
  child.on('exit', (code) => resolve(code === 0));
});

const prefixOutput = (label, stream, printer) => {
  const rl = readline.createInterface({ input: stream });
  rl.on('line', line => printer(label, line));
  return rl;
};

const spawnManaged = (label, command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  processes.push(child);
  const stdout = prefixOutput(label, child.stdout, log);
  const stderr = prefixOutput(label, child.stderr, logError);
  child.on('exit', (code, signal) => {
    stdout.close();
    stderr.close();
    if (!shuttingDown && code !== 0) {
      logError(label, `processo encerrado com codigo ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`);
    }
  });
  child.on('error', (error) => {
    logError(label, error.message);
  });
  return child;
};

const spawnManagedWithParsers = (label, command, args, { onStdoutLine, onStderrLine, ...options } = {}) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  processes.push(child);
  const stdoutRl = readline.createInterface({ input: child.stdout });
  const stderrRl = readline.createInterface({ input: child.stderr });
  stdoutRl.on('line', line => {
    log(label, line);
    onStdoutLine?.(line, child);
  });
  stderrRl.on('line', line => {
    logError(label, line);
    onStderrLine?.(line, child);
  });
  child.on('exit', (code, signal) => {
    stdoutRl.close();
    stderrRl.close();
    if (!shuttingDown && code !== 0) {
      logError(label, `processo encerrado com codigo ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`);
    }
  });
  child.on('error', (error) => {
    logError(label, error.message);
  });
  return child;
};

const runCommand = (label, command, args) => new Promise((resolve, reject) => {
  const child = spawnManaged(label, command, args);
  child.on('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${label} falhou com codigo ${code ?? 'null'}.`));
  });
  child.on('error', reject);
});

const waitForPort = async (port, label, timeoutMs = 30000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (connected) {
      log('dev', `${label} pronto em 127.0.0.1:${port}`);
      return;
    }
    await delay(500);
  }
  throw new Error(`Tempo esgotado aguardando ${label} em 127.0.0.1:${port}.`);
};

const ensurePortAvailable = async ({ port, label }) => {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      reject(new Error(`${label} precisa da porta ${port}, mas ela nao esta disponivel: ${error.message}`));
    });
    server.listen(port, '127.0.0.1', () => {
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve();
      });
    });
  });
};

const setupLocalEnv = () => {
  const rootEnv = mergeEnvFile(rootEnvPath, {
    VITE_STRIPE_PUBLISHABLE_KEY: '',
  }, {
    VITE_FIREBASE_API_KEY: 'demo-local-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
    VITE_FIREBASE_PROJECT_ID: projectId,
    VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.firebasestorage.app`,
    VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    VITE_FIREBASE_APP_ID: '1:000000000000:web:maresia-grill-local',
    VITE_PUBLIC_ORDER_API_URL: functionsBaseUrl,
  });

  const functionsEnv = mergeEnvFile(functionsEnvPath, {
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
  });

  log('dev', `env local preparado em ${path.relative(repoRoot, rootEnvPath)} e ${path.relative(repoRoot, functionsEnvPath)}`);
  return { rootEnv, functionsEnv };
};

const resolveStripeState = async (rootEnv, functionsEnv) => {
  const publishableKey = rootEnv.get('VITE_STRIPE_PUBLISHABLE_KEY')?.trim() ?? '';
  const secretKey = functionsEnv.get('STRIPE_SECRET_KEY')?.trim() ?? '';
  if (!publishableKey || !secretKey) {
    return {
      enabled: false,
      reason: 'configure VITE_STRIPE_PUBLISHABLE_KEY em .env.local e STRIPE_SECRET_KEY em apps/functions/.env.local para ativar o checkout Stripe',
    };
  }

  const hasStripeCli = await commandExists('stripe');
  if (!hasStripeCli) {
    return {
      enabled: false,
      reason: 'Stripe CLI ausente; instale e autentique para ter webhook local automatico',
    };
  }

  return { enabled: true, publishableKey, secretKey };
};

const startStripeListener = async () => {
  log('dev', 'iniciando Stripe CLI para capturar o webhook secret local');

  return new Promise((resolve) => {
    let settled = false;
    let child;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!result.enabled && child && !child.killed) child.kill('SIGTERM');
      resolve(result);
    };
    const timeout = setTimeout(() => {
      finish({
        enabled: false,
        reason: 'nao foi possivel capturar o webhook secret da Stripe CLI a tempo',
      });
    }, 12000);

    const consume = (line) => {
      const match = line.match(/(whsec_[A-Za-z0-9]+)/);
      if (!match) return;
      updateEnvValue(functionsEnvPath, 'STRIPE_WEBHOOK_SECRET', match[1]);
      log('dev', 'webhook secret local capturado e salvo em apps/functions/.env.local');
      finish({
        enabled: true,
        secret: match[1],
      });
    };

    child = spawnManagedWithParsers('stripe', 'stripe', ['listen', '--forward-to', webhookForwardUrl], {
      onStdoutLine: consume,
      onStderrLine: consume,
    });

    child.on('exit', (code) => {
      if (settled) return;
      finish({
        enabled: false,
        reason: `Stripe CLI encerrou antes de disponibilizar o webhook secret (codigo ${code ?? 'null'})`,
      });
    });
  });
};

const seedLocalData = async (scriptName) => {
  await runCommand('seed', 'node', [path.join('tools', 'scripts', scriptName)]);
};

const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log('dev', `encerrando processos (${signal})`);
  for (const child of processes) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const child of processes) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 1500);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main() {
  const hasNpx = await commandExists(firebaseCommand);
  if (!hasNpx) {
    throw new Error('npx nao encontrado neste ambiente.');
  }
  const hasPnpm = await commandExists(pnpmCommand);
  if (!hasPnpm) {
    throw new Error('pnpm nao encontrado neste ambiente.');
  }

  const { rootEnv, functionsEnv } = setupLocalEnv();
  const stripeState = await resolveStripeState(rootEnv, functionsEnv);

  for (const portConfig of requiredPorts) {
    await ensurePortAvailable(portConfig);
  }

  let stripeRuntime = stripeState;
  if (stripeState.enabled) {
    stripeRuntime = await startStripeListener();
  } else {
    log('dev', `checkout Stripe opcional desativado: ${stripeState.reason}`);
  }

  await runCommand('functions:build', pnpmCommand, ['--filter', '@maresia-grill/functions', 'build']);

  spawnManaged('emulators', firebaseCommand, ['firebase-tools', 'emulators:start', '--project', projectId], {
    env: {
      ...process.env,
      NO_UPDATE_NOTIFIER: '1',
    },
  });
  await waitForPort(8180, 'Firestore emulator');
  await waitForPort(5001, 'Functions emulator');

  await seedLocalData('seed.js');

  spawnManaged('vite', pnpmCommand, ['run', 'dev:web']);
  await waitForPort(5173, 'Vite');

  log('dev', 'ambiente local pronto');
  log('dev', `app: ${appOrigin}`);
  log('dev', `emulator ui: http://127.0.0.1:4000`);
  log('dev', `pedido publico: ${appOrigin}/s/teste-pagamento/#/pedido`);
  if (stripeRuntime.enabled) {
    log('dev', 'Stripe local ativo para checkout e webhook');
  } else {
    log('dev', `Stripe local pendente: ${stripeRuntime.reason}`);
  }

  await new Promise(() => {});
}

main().catch((error) => {
  logError('dev', error instanceof Error ? error.message : String(error));
  shutdown('erro', 1);
});
