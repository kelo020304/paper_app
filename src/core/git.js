'use strict';

const { spawn } = require('node:child_process');

function runGit(cwd, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code === 0 || allowFailure) resolve(result);
      else reject(new Error(stderr.trim() || `git ${args[0]} 失败（退出码 ${code}）`));
    });
  });
}

async function gitStatus(vaultPath) {
  const inside = await runGit(vaultPath, ['rev-parse', '--is-inside-work-tree'], { allowFailure: true });
  if (inside.code !== 0) return { initialized: false, remote: '', branch: '', dirty: false };
  const remote = await runGit(vaultPath, ['remote', 'get-url', 'origin'], { allowFailure: true });
  const branch = await runGit(vaultPath, ['branch', '--show-current'], { allowFailure: true });
  const dirty = await runGit(vaultPath, ['status', '--porcelain']);
  return { initialized: true, remote: remote.stdout, branch: branch.stdout, dirty: Boolean(dirty.stdout) };
}

async function configureGit(vaultPath, remote, branch = 'vault') {
  const status = await gitStatus(vaultPath);
  if (!status.initialized) await runGit(vaultPath, ['init', '-b', branch]);
  const currentRemote = await runGit(vaultPath, ['remote', 'get-url', 'origin'], { allowFailure: true });
  if (remote) {
    if (currentRemote.code === 0) await runGit(vaultPath, ['remote', 'set-url', 'origin', remote]);
    else await runGit(vaultPath, ['remote', 'add', 'origin', remote]);
  }
  return gitStatus(vaultPath);
}

async function syncGit(vaultPath, branch = 'vault') {
  const status = await gitStatus(vaultPath);
  if (!status.initialized) throw new Error('请先在设置中连接 GitHub 仓库');
  if (!status.remote) throw new Error('尚未配置 origin 远程仓库');

  const remoteBranch = await runGit(vaultPath, ['ls-remote', '--exit-code', '--heads', 'origin', branch], { allowFailure: true });
  const localHead = await runGit(vaultPath, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true });

  // A new machine already has local vault.json/README files. Attach its unborn
  // branch to the existing remote history while preserving those working files.
  if (remoteBranch.code === 0 && localHead.code !== 0) {
    await runGit(vaultPath, ['fetch', 'origin', branch]);
    await runGit(vaultPath, ['checkout', 'FETCH_HEAD', '--', '.']);
    await runGit(vaultPath, ['reset', '--mixed', 'FETCH_HEAD']);
  }

  await runGit(vaultPath, ['add', '--all']);
  const staged = await runGit(vaultPath, ['diff', '--cached', '--quiet'], { allowFailure: true });
  if (staged.code !== 0) {
    await runGit(vaultPath, ['commit', '-m', `Paper Vault sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`]);
  }

  if (remoteBranch.code === 0 && localHead.code === 0) {
    try {
      await runGit(vaultPath, ['pull', '--rebase', 'origin', branch]);
    } catch (error) {
      await runGit(vaultPath, ['rebase', '--abort'], { allowFailure: true });
      throw new Error(`自动合并失败，本地内容已保留。请解决 Git 冲突后重试：${error.message}`);
    }
  }
  await runGit(vaultPath, ['push', '-u', 'origin', branch]);
  return gitStatus(vaultPath);
}

module.exports = { runGit, gitStatus, configureGit, syncGit };
