# 配套技能验收指南 / Bundled skill verification

[中文](#中文) | [English](#english)

<a id="中文"></a>
## 中文

这份指南用于验证插件版 good-readme 与 gitwork 的显式调用流程。资源和脚本测试通过后，还需要在真实项目聊天中核对技能来源与实际结果。

### 1. 确认技能来源

在已加载插件的项目聊天中发送：

> 检查 Git 总览插件 project-versions 提供的 good-readme 和 gitwork 是否已加载，并列出各自的 SKILL.md 路径。

应能识别 `project-versions:good-readme` 和 `project-versions:gitwork`。本地缓存安装的路径通常包含 `plugins/cache/project-versions-local/project-versions/<版本>/skills/`；以当前宿主实际加载的路径为准。若路径来自个人技能目录，则本轮尚不能证明调用了插件版。

可保留个人技能文件，只禁用个人版对应条目，并保留插件版启用。修改技能配置后重启 Codex，再进入项目聊天检查。安装或启用状态本身不等于技能已执行。

### 2. 执行一次有实际价值的文档修改

发送下面的请求，也可以将“文档说明”换成项目当前确实需要的小改动：

> 给当前项目补充一项有用的文档说明，使用插件提供的 good-readme 检查 README，再使用 gitwork 完成本次修改的本地提交。请说明所用技能的来源。

Codex 应先记录当前分支、暂存和未暂存变更；完成修改后，使用插件目录内的 README 证据脚本检查文档影响。Python 3 不可用时可使用宿主工具收集同样的证据，并说明脚本未运行。README 仅在必要时更新，遵循项目现有语言；已有翻译同步相关事实。

最后检查实际 diff 和新增文件，只纳入本次修改，再按项目提交规范创建本地提交。已有无关修改应保留；无法安全隔离时应说明未提交原因。只读检查、没有实际变更或用户要求不提交时，不应为了验收制造提交。面板与 MCP 服务仍为只读，写入由 Codex 的宿主工具执行。

### 3. 核对验收证据

- 技能来源是插件目录，README 检查与提交收尾各执行一次。
- 最终报告包含 `README: created`、`README: updated` 或 `README: unchanged`，并说明对应结果。
- 提交存在时，报告的哈希和标题与实际 `git log -1` 一致，内容只包含本次修改。
- 最终 `git status --short` 与开始时的基线对照，清楚区分遗留的用户修改与本次未完成内容；没有推送或改写历史。

这验证的是显式调用。若要另外验证自动选择，在新聊天中提出同类实际项目修改请求并省略技能名称，核对宿主是否选择了这两个技能；不能用一次显式调用的成功推断每次都会自动触发。

[返回 README](../README.md#中文)

<a id="english"></a>
## English

Use this guide to verify explicit invocation of the plugin's good-readme and gitwork skills. Resource and script tests should be followed by checking skill provenance and actual results in a real project chat.

### 1. Confirm skill provenance

In a project chat with the plugin loaded, send:

> Check whether good-readme and gitwork from the Git overview plugin project-versions are loaded, and list their SKILL.md paths.

The host should identify `project-versions:good-readme` and `project-versions:gitwork`. A local cached installation typically has `plugins/cache/project-versions-local/project-versions/<version>/skills/` in its paths; use the paths actually loaded by the host. A path from a personal skill directory does not establish that the plugin version was invoked.

You can retain personal skill files, disable only their personal entries, and leave the plugin versions enabled. Restart Codex after changing skill configuration, then check again in a project chat. Installation or enabled status alone does not establish execution.

### 2. Make one useful documentation change

Send this request, or replace the documentation task with a small change the project actually needs:

> Add one useful documentation note to the current project, use the plugin's good-readme to check README, then use gitwork to create a local commit for this change. State which skill sources you used.

Codex should first record the current branch and staged and unstaged changes. After the edit, it should use the README evidence script inside the plugin directory to assess documentation impact. If Python 3 is unavailable, host tools can collect equivalent evidence, with disclosure that the script was not run. Update README only when needed, preserve the project's language, and synchronize affected translations.

Finally, review the actual diff and new files, include only this task's changes, and create a local commit following project conventions. Preserve unrelated changes; if isolation is unsafe, explain why no commit was created. Do not manufacture commits for read-only checks, tasks with no actual changes, or requests to leave changes uncommitted. The panel and MCP service remain read-only; Codex's host tools perform writes.

### 3. Check the acceptance evidence

- Skill sources are inside the plugin directory, with one README gate and one Git completion workflow.
- The final report includes `README: created`, `README: updated`, or `README: unchanged`, with an explanation.
- When a commit exists, its reported hash and subject match the actual `git log -1`, and its contents belong only to this task.
- Compare the final `git status --short` against the initial baseline, distinguishing existing user changes from unfinished task work. No push or history rewrite occurs.

This verifies explicit invocation. To test automatic selection separately, start a new chat with a similar real project change request but omit skill names, then check whether the host selects these skills. One successful explicit invocation does not establish automatic invocation on every task.

[Back to README](../README.md#english)
