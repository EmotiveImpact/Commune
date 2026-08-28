import { spawn } from 'node:child_process';

function tokenizeNodeOptions(value) {
  return value.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
}

function sanitizeNodeOptions(value) {
  const tokens = tokenizeNodeOptions(value);
  const nextTokens = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;

    if (token === '--localstorage-file') {
      const nextToken = tokens[index + 1];
      if (nextToken && !nextToken.startsWith('-')) {
        index += 1;
      }
      continue;
    }

    if (token.startsWith('--localstorage-file=')) {
      continue;
    }

    nextTokens.push(token);
  }

  return nextTokens.join(' ').trim();
}

const env = { ...process.env };
if (env.NODE_OPTIONS) {
  const sanitized = sanitizeNodeOptions(env.NODE_OPTIONS);
  if (sanitized) {
    env.NODE_OPTIONS = sanitized;
  } else {
    delete env.NODE_OPTIONS;
  }
}

function forwardStream(stream, writer) {
  let remainder = '';
  let suppressTraceLine = false;

  function flushChunk(chunk) {
    const next = remainder + chunk.toString();
    const lines = next.split('\n');
    remainder = lines.pop() ?? '';

    for (const line of lines) {
      const normalizedLine = `${line}\n`;
      if (normalizedLine.includes('`--localstorage-file` was provided without a valid path')) {
        suppressTraceLine = true;
        continue;
      }

      if (
        suppressTraceLine &&
        normalizedLine.includes('Use `node --trace-warnings ...` to show where the warning was created')
      ) {
        suppressTraceLine = false;
        continue;
      }

      suppressTraceLine = false;
      writer.write(normalizedLine);
    }
  }

  stream.on('data', flushChunk);
  stream.on('end', () => {
    if (!remainder) return;
    if (remainder.includes('`--localstorage-file` was provided without a valid path')) {
      return;
    }
    if (
      suppressTraceLine &&
      remainder.includes('Use `node --trace-warnings ...` to show where the warning was created')
    ) {
      return;
    }
    writer.write(remainder);
  });
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['exec', 'vitest', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

if (child.stdout) {
  forwardStream(child.stdout, process.stdout);
}

if (child.stderr) {
  forwardStream(child.stderr, process.stderr);
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
