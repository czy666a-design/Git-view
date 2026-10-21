import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fixtureGit } from './fixture.js';

// Run this suite against an extracted package as well as the source tree.
const pluginRoot = resolve(process.env.PLUGIN_BUNDLE_DIR || '.');
const helper = join(pluginRoot, 'skills/good-readme/scripts/inspect_readme_context.py');
const python = execFileSync(process.env.PYTHON || 'python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).trim();
function inspect(path: string, cwd: string, env = process.env) {
  return JSON.parse(execFileSync(python, [helper, path], { cwd, env, encoding: 'utf8' }));
}

test('插件清单分发三个独立技能及自足的辅助资源', async () => {
  const manifest = JSON.parse(await readFile(join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
  const skills = resolve(pluginRoot, manifest.skills);
  assert.deepEqual((await readdir(skills)).sort(), ['gitwork', 'good-readme', 'project-versions']);
  for (const skill of await readdir(skills)) {
    assert.ok((await readFile(join(skills, skill, 'SKILL.md'), 'utf8')).startsWith('---\n'));
  }
  for (const path of ['gitwork/agents/openai.yaml', 'good-readme/agents/openai.yaml', 'good-readme/references/readme-contract.md', 'good-readme/LICENSE']) {
    assert.ok((await readFile(join(skills, path), 'utf8')).length > 0);
  }
});

test('README 辅助脚本可在插件目录外检查无 Git 项目，Git 不可用时仍可收集文档证据', async () => {
  const root = await mkdtemp(join(tmpdir(), 'readme-no-git-'));
  try {
    await writeFile(join(root, 'README.md'), '# 项目\n');
    await writeFile(join(root, 'package.json'), '{}\n');
    for (const env of [process.env, { ...process.env, PATH: '' }]) {
      const result = inspect(root, tmpdir(), env);
      assert.equal(result.project_path, await realpath(root));
      assert.equal(result.readme_md_exists, true);
      assert.deepEqual(result.project_markers, ['package.json']);
      assert.equal(result.git.scope, 'none');
      assert.deepEqual(result.git.status_in_project, []);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('README 证据保留暂存/未暂存状态、重命名和文件名尾部空白，且不改写 Git 索引', async () => {
  const root = await mkdtemp(join(tmpdir(), 'readme-status-'));
  try {
    fixtureGit(root, ['init', '-b', 'main']);
    await writeFile(join(root, 'tracked.txt'), 'baseline\n');
    await writeFile(join(root, 'old.txt'), 'unique rename content\n');
    fixtureGit(root, ['add', '--', 'tracked.txt', 'old.txt']);
    fixtureGit(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'baseline']);
    await writeFile(join(root, 'tracked.txt'), 'staged\n');
    const renamed = '重命名 \n.txt ';
    await rename(join(root, 'old.txt'), join(root, renamed));
    fixtureGit(root, ['add', '--', 'tracked.txt', 'old.txt', renamed]);
    await writeFile(join(root, 'tracked.txt'), 'unstaged\n');
    const untracked = '新文件\t\r\n ';
    await writeFile(join(root, untracked), 'new\n');
    const indexBefore = await readFile(join(root, '.git/index'));
    const result = inspect(root, tmpdir());
    assert.equal(result.git.scope, 'project');
    assert.deepEqual(result.git.status_in_project.find((entry: any) => entry.path === 'tracked.txt'), { status: 'MM', path: 'tracked.txt' });
    assert.deepEqual(result.git.status_in_project.find((entry: any) => entry.path === renamed), { status: 'R ', path: renamed, source_path: 'old.txt' });
    assert.deepEqual(result.git.status_in_project.find((entry: any) => entry.path === untracked), { status: '??', path: untracked });
    assert.deepEqual(await readFile(join(root, '.git/index')), indexBefore);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('嵌套项目只报告自身变更并明确标识祖先仓库', async () => {
  const root = await mkdtemp(join(tmpdir(), 'readme-scope-'));
  const project = join(root, '项目');
  try {
    fixtureGit(root, ['init', '-b', 'main']);
    await mkdir(project);
    await writeFile(join(root, 'outside.txt'), 'outside\n');
    await writeFile(join(project, 'inside.txt'), 'inside\n');
    const result = inspect(project, tmpdir());
    assert.equal(result.git.scope, 'ancestor');
    assert.ok(result.git.warning);
    assert.deepEqual(result.git.status_in_project, [{ status: '??', path: '项目/inside.txt' }]);
    assert.equal(result.readme_md_exists, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('README 辅助脚本拒绝相对路径和不存在的项目', async () => {
  const root = await mkdtemp(join(tmpdir(), 'readme-invalid-'));
  try {
    for (const args of [[], ['.'], [join(root, 'missing')]]) {
      const result = spawnSync(python, [helper, ...args], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 2);
      assert.equal(result.stdout, '');
      assert.ok(result.stderr);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
