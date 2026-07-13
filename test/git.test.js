'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const library = require('../src/core/library');
const git = require('../src/core/git');

test('first sync commits and pushes the vault to a remote repository', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-vault-git-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault');
  const remote = path.join(root, 'remote.git');
  await fs.mkdir(vault);
  await library.ensureVault(vault);
  await git.runGit(root, ['init', '--bare', remote]);
  await git.configureGit(vault, remote, 'main');
  await git.runGit(vault, ['config', 'user.name', 'Paper Vault Test']);
  await git.runGit(vault, ['config', 'user.email', 'paper-vault@example.invalid']);
  await library.upsertPaper(vault, { id: '2406.12345', baseId: '2406.12345', title: 'Synced Paper' });
  const status = await git.syncGit(vault, 'main');
  const remoteHead = await git.runGit(root, ['--git-dir', remote, 'rev-parse', 'refs/heads/main']);
  assert.equal(status.initialized, true);
  assert.equal(status.dirty, false);
  assert.match(remoteHead.stdout, /^[0-9a-f]{40}$/);

  const secondVault = path.join(root, 'second-vault');
  await fs.mkdir(secondVault);
  await library.ensureVault(secondVault);
  await git.configureGit(secondVault, remote, 'main');
  await git.runGit(secondVault, ['config', 'user.name', 'Paper Vault Test']);
  await git.runGit(secondVault, ['config', 'user.email', 'paper-vault@example.invalid']);
  await git.syncGit(secondVault, 'main');
  const pulledPapers = await library.listPapers(secondVault);
  assert.equal(pulledPapers.length, 1);
  assert.equal(pulledPapers[0].title, 'Synced Paper');
});
