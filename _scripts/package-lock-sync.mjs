import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const shouldWrite = process.argv.includes('--write');
const shouldForceWrite = shouldWrite && process.argv.includes('--force');

await checkNpmVersion('10.8.0');

const cwd = path.resolve(__dirname, '..');

const starters = fs.readdirSync(cwd, { withFileTypes: true });

// iterate over all starters and check if the `package-lock.json` is in sync with the `package.json`
const promises = [];

for (const starter of starters) {
  const dir = path.join(cwd, starter.name);

  if (
    !starter.isDirectory() ||
    !fs.existsSync(path.join(dir, 'package.json'))
  ) {
    // we're only interested in directories containing a `package.json`
    continue;
  }

  if (shouldWrite) {
    promises.push(updatePackageLock(dir, starter.name, shouldForceWrite));
  } else {
    promises.push(checkPackageLockSync(dir, starter.name));
  }
}

const result = await Promise.allSettled(promises);

let exitCode = 0;

for (const { status, reason } of result) {
  if (status === 'rejected') {
    exitCode = 1;

    console.error(reason.message);
  }
}

process.exit(exitCode);

function checkNpmVersion(expected) {
  const child = childProcess.spawnSync('npm', ['--version']);

  const version = child.stdout.toString().trim();

  if (version !== expected) {
    console.error(`Expected npm version ${expected}, but found ${version}.`);

    process.exit(1);
  }
}

function checkPackageLockSync(directory, name) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(directory, 'package-lock.json'))) {
      reject(
        new Error(`No \`package-lock.json\` found for starter \`${name}\`.`)
      );

      return;
    }

    const child = childProcess.spawn('npm', ['ci'], {
      stdio: 'ignore',
      cwd: directory,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `The \`package-lock.json\` is not in sync with the \`package.json\` for starter \`${name}\`.`
          )
        );
      }
    });
  });
}

function updatePackageLock(directory, name, force) {
  return new Promise((resolve, reject) => {
    // we only write the `package-lock.json` if it does not exist or if the `--force` flag is set
    if (!force && fs.existsSync(path.join(directory, 'package-lock.json'))) {
      resolve();

      return;
    }

    const child = childProcess.spawn(
      'npm',
      ['install', '--package-lock-only', '--ignore-scripts'],
      {
        stdio: 'ignore',
        cwd: directory,
      }
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Failed to update the \`package-lock.json\` for starter \`${name}\`.`
          )
        );
      }
    });
  });
}
