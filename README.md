# Git 总览

[中文](#中文) | [English](#english)

<a id="中文"></a>
## 中文

偶尔打开，看清项目现在在哪里。

在 Codex 工作空间内查看真实 Git 提交与分支关系：当前位置、分叉、合并、未提交修改。点击节点后展开详情，点击文件后才读取源码差异。需要解释或操作时，将所选上下文交给当前 Codex 聊天。另附 good-readme 与 gitwork 技能，帮助 Codex 同步项目文档、检查变更归属并完成本地提交收尾。

### 推荐用法：从项目对话打开

1. 在 Codex 中打开要查看的项目，进入该项目的对话。
2. 发送「打开当前项目的 Git 总览」。Codex 会将当前聊天实际工作树的 Git 根目录和聊天标识传给插件，无需手填路径；worktree 聊天使用自身目录，不替换为主项目目录。
3. 面板打开后即可查看；以后重新打开项目或换到另一个项目时，在对应对话中再发起一次。

如果当前对话没有绑定项目，需先打开项目，或明确告诉 Codex 要查看的项目绝对路径。插件无法从一个没有项目上下文的对话判断目标仓库。

从 0.2.5 起，插件在界面资源中声明首选 `fullscreen` 显示模式，希望从对话发起时也优先在宿主独立面板（桌面端的标签页面板）中打开，方便持续查看分支图。项目路径仍由对话带入。这是传给宿主的显示偏好，不保证所有宿主都采用；实际位置由宿主决定。更新后需要宿主重新读取界面资源才能生效，旧面板不代表新版行为。它与“先新建空标签页，再从菜单打开”是两个入口，后者的项目路径限制见下文。

#### 新标签页入口的当前限制

截至 2026-10-20，本机 Codex 与插件 0.2.4 的验证结果如下：

| 打开方式 | 项目路径 | 当前结果 |
| --- | --- | --- |
| 项目对话中说「打开当前项目的 Git 总览」 | Codex 显式带入 | 已验证原生面板连接成功，无需手填 |
| 新标签页 → 更多工具 → 打开 Git 总览 | 当前入口未提供插件可用的项目目录 | 显示路径输入页，需要手动指定 |

新标签页使用无参数入口。插件会尝试读取宿主提供的工作空间目录，但本机当前调用未能获得可用目录，实际返回 `projectRequired: true`。这是当前入口的上下文限制；插件能够正常启用，也不代表该入口能自动识别项目。

**从对话打开一次，不会让之后的新标签页自动带入同一个项目。** 当前实现不保存跨面板的默认项目。若希望省去路径填写，请持续使用项目对话入口；若使用新标签页入口，填写目标 Git 项目文件夹的绝对路径后点击「打开项目」。

启动配置中的 `cwd: "."` 用于定位插件自身的服务文件，不是用户项目路径。此前移除工作目录以尝试继承项目目录曾导致插件启动失败，因此不要通过修改该配置解决路径填写问题。此结论针对当前实测宿主，未来宿主若提供可用的工作空间上下文，插件已有对应读取逻辑。排查证据见 [验证记录](docs/verification.md)。

### 查看与后续操作

1. 确认顶部项目名及“查看工作树”中的分支、目录是本次要查看的对象。可选择同仓库的其他工作树；选择只改变查看对象，不切换 Git 分支。
2. 默认看到全部本地分支，每个节点是一次提交；“工作树 HEAD”标明当前查看目录的 HEAD。
3. 点击分支名查看关系与进展，点击提交查看说明和文件。未提交修改单独用虚线入口展示。
4. 「显示远程」展示本机已有的远程引用，不自动联网更新。
5. 「交给 Codex」先打开可编辑请求草稿，包含所选对象、项目路径、当前分支和 HEAD。确认发送后，Codex 再检查现场并按请求处理。普通浏览器可复制请求。

打开、重新获得焦点或手动刷新时读取状态。分支筛选和定位只改变视图。

例如，可以在「交给 Codex」的草稿里写「解释这次提交改了什么」「比较这个分支与当前分支」或「我想在这个分支继续开发，请先检查当前状态」。插件负责传递上下文；Git 操作由 Codex 根据你的请求执行。

### 工作树与聊天的对应关系

从 0.2.6 起，面板顶部显示“查看工作树”，列出同仓库各工作树的分支和完整目录，并以“工作树 HEAD”标记所选目录的位置。多个工作树共享分支与提交历史，各自的 HEAD 和未提交修改独立：即使图里能看到 `Function` 的提交，也不代表面板正在读取 `Function` 工作树。

面板绑定打开时指定的目录，不会因切换聊天而自动重绑。若聊天位于 `Function` 而面板显示另一工作树，可在选择框改为对应目录，或从该聊天重新请求打开。更换查看对象后，HEAD、未提交修改及交给 Codex 的上下文一起更新，旧筛选与详情清除；读取失败时保留原视图。现有 MCP 工具仍只读，选择不会执行 checkout、暂存或提交。

### 配套开发收尾技能

插件通过 `skills/` 分发三个独立技能：

| 技能 | 触发与作用 |
| --- | --- |
| `project-versions` | 打开总览、查看分支与提交关系；阅读和解释不触发提交 |
| `good-readme` | 修改非 README 项目文件后检查文档影响，按需创建或同步 README |
| `gitwork` | 实际项目修改时检查基线、隔离本次变更、排除本地产物并完成本地提交 |

完成实现与验证后，先检查 README，再审阅完整变更并执行 Git 收尾。两个技能优先遵循用户与目标项目的 `AGENTS.md`：保留文档现有语言和组织，已有翻译同步必要事实；提交语言、类型和 scope 遵循项目规范。用户要求不提交、仅生成说明或不执行 Git 时，按用户选择处理。目标目录上层的仓库不视为当前项目仓库；自动创建的独立聊天目录默认不执行 Git 收尾，明确指定的项目 worktree 可以正常使用。

**gitwork 被触发后，符合条件时会通过 Codex 的宿主工具创建本地提交；不自动推送或改写历史。good-readme 也可能编辑 README。** 面板和 MCP 工具仍为只读，这些修改由 Codex 按当前对话的授权和权限执行。技能不是后台钩子，安装不等于每次任务必定触发；安装后需在新会话确认宿主已加载相应技能。若已有同名个人技能，按同一流程执行一次，避免重复检查或提交；本插件不覆盖或删除个人技能。

可在已加载插件的新会话中明确请求：“使用 good-readme 检查本次改动是否需要更新 README”，或“使用 gitwork 检查当前项目并完成本次改动的 Git 收尾”。仅查看时仍发送“打开当前项目的 Git 总览”。

good-readme 的 `scripts/inspect_readme_context.py` 和 `references/readme-contract.md` 随包提供，路径相对安装后的技能目录。辅助脚本需要 Python 3；不可用时由 Codex 使用宿主工具收集同样的证据。脚本可检查无 Git 项目，并标识祖先仓库，不修改 README 或 Git 索引。

验证插件版是否实际参与文档检查与本地提交，见[配套技能验收指南](docs/skill-verification.md#中文)，包含来源核对、完整请求示例与验收证据。

### 常见问题

- **出现项目路径输入页：** 使用了未带入项目目录的入口。推荐回到项目对话说「打开当前项目的 Git 总览」；继续使用该页则需要填写绝对路径。反复重启不会补上缺失的项目上下文。
- **显示“未能显示”或一直无法连接：** 与路径输入页不同，这是启动或面板连接问题。安装或更新后若仍在使用旧服务，可完全退出 Codex 后重开，再从项目对话打开；仍失败时请 Codex 检查最新启动日志及 `check_project_versions_ready` 回执，不能仅凭“插件已启用”认定连接正常。
- **连接已过期：** 已有面板保存了工作树路径时，点击“重新读取”会创建新会话并重新读取该目录，保留聊天标识，重新发送连接回执；不会复用失效 ID，也不会退回主工作树。恢复成功后清除旧筛选和详情。若新连接仍失败，隐藏“重新读取”并禁用刷新，提示从当前聊天重新打开；尚未取得项目路径的连接错误也不提供无效的重试按钮。
- **没有提交关系图：** 确认项目已有 Git 提交。只有未提交文件、尚无第一次提交的仓库没有提交节点；插件不会自动创建提交。
- **面板分支与当前聊天不同：** 核对“查看工作树”中的实际目录。切换到该聊天的工作树，或从对应聊天重新打开；刷新只读取面板原来绑定的目录。
- **Codex 操作后图没更新：** 点击刷新。重新打开时，请在目标项目的对话中发起，避免沿用另一个项目的面板。

### 提交说明规范与自动生成

推荐默认使用“英文类型 + 中文短标题”，复杂修改才补充正文。这样在分支图中可以快速辨认每次提交的目的，点击提交后再查看必要的细节。

桌面端提交框里的“留空将自动生成”属于宿主的 Git 功能，Git 总览插件仅展示已有提交原文。根据本机安装版本的实现，生成时会使用“设置 → Git → Commit instructions（提交说明）”、输入框中的草稿和变更内容；变更较大时可能只传入统计摘要，生成上下文也注明不包含未跟踪文件。即使勾选了“包含未暂存的更改”，也不能据此认定生成器看到了所有新增文件内容。这些是当前版本的实现情况，不保证其他版本采用完全相同的上下文。

#### 设置与使用

1. 打开桌面端“设置 → Git → Commit instructions”，复制下方完整规则并保存。这项设置影响该桌面端的所有项目，不会随插件安装自动写入。
2. 对话中的提交使用全局 `~/.codex/AGENTS.md` 中的同一套规则；新对话会按宿主机制加载全局指令，已有对话若未加载，可明确要求按本节规范生成说明。仓库中更具体的指令仍可能影响实际结果。
3. 简单且上下文完整的修改，可以使用原生自动生成；较大改动、大量新增文件或混合改动，推荐先在对话中说：“检查本次拟提交的实际变更和新增文件，按统一规范生成提交说明草稿，先不要提交。”检查草稿后再要求提交，或将草稿填入原生提交框。
4. 不要求每次附带正文或测试段落；未执行的验证不能写成“已通过”。不要为了改善说明而修改历史提交。

本次配置已准备了可复制规则：[commit-instructions.txt](docs/commit-instructions.txt)。桌面端设置因计算机控制工具拒绝访问，**尚需用户在设置中手动粘贴并保存**；文档中的规则本身不表示原生设置已经生效。

#### 可直接复制的生成规则

<!-- commit-instructions:start -->
```text
生成 Git 提交说明时，默认遵循以下规则：

1. 标题采用“类型(可选范围): 中文说明具体变化”。类型保留英文，标题及按需补充的正文使用中文；代码标识、分支名和版本号保留原文。标题尽量不超过 50 个字符，不加句末句号。
2. 标题写清具体对象及发生的变化，优先描述能被后续阅读者理解的行为或结果。避免“更新代码”“优化体验”“修复问题”“完成任务”等空泛描述，也不要只罗列文件名。
3. 仅在有助于识别模块时填写范围，例如“分支图”“项目绑定”；不强制每次填写。
4. 根据实际变更目的选择一个主要类型：
   feat：新增功能或特性。
   fix：修复 bug、错误或不符合预期的行为。
   perf：不改变预期功能的性能优化；没有证据时不宣称性能提升。
   refactor：不改变预期功能或行为的代码结构调整。
   docs：文档修改。
   style：仅格式调整，例如缩进、分号和空格；不是 CSS 修改的通用类型。
   test：测试用例新增或修改。
   build：构建系统、打包或依赖项修改。
   revert：撤销已有提交，并在正文中指出被撤销的提交及原因（仅在信息已知时填写）。
   ci：持续集成、持续交付流水线配置修改。
   chore：确实不属于其他类型的维护工作，不作为万能分类。
   release：发布新版本，并写清实际版本号。
   workflow：除 CI/CD 外的工作流程、协作流程或自动化流程修改。
5. CSS 修改按目的选择 feat、fix、refactor 等类型，不能仅因修改 CSS 就归为 style。功能修改附带测试时按主要功能目的分类，不必强行拆开相关测试。
6. 简单修改只写短标题。复杂修改才在空行后补充简短正文，说明必要的原因、影响或实际验证结果；正文不得重复标题，不强制填满固定模板。
7. 以本次将提交的实际变更和明确需求为依据。在对话中执行提交前检查待提交 diff，以及拟纳入的新文件内容；不要把整个聊天中的计划、未实现功能或未纳入提交的内容写进去。上下文只有统计摘要或缺少文件内容时，不推测具体功能，不编造原因、用户需求、测试通过或性能收益，优先使用用户已明确提供的草稿信息。
8. 一次提交围绕一个主要目的。对话中发现互不相关的改动时先建议拆分；不能仅凭这一规则擅自提交、暂存或推送。仅请求生成说明时，只返回提交说明草稿。

标题示例：
fix(分支图): 修复远程分支标签文字重叠
feat(总览): 支持按分支筛选提交历史
docs: 补充新标签页打开时的项目路径限制
release: 发布 Git 总览 0.2.5
```
<!-- commit-instructions:end -->

#### 分类与表达示例

| 实际变更 | 建议标题或处理方式 |
| --- | --- |
| 新增按分支筛选提交历史 | `feat(总览): 支持按分支筛选提交历史` |
| 修复远程分支标签文字重叠，包含 CSS 修改 | `fix(分支图): 修复远程分支标签文字重叠` |
| 只调整缩进与分号 | `style: 统一提交图组件的缩进与分号` |
| 仅补充新标签页路径说明 | `docs: 补充新标签页打开时的项目路径限制` |
| 新增功能并补充该功能的测试 | 以 `feat` 描述该功能，不强行拆出测试提交 |
| 同时修改分支筛选与独立的安装文档 | 建议拆分 `feat` 和 `docs`，不以 `chore` 概括全部 |
| 只有“修改若干文件”的统计，没有内容 | 先检查实际 diff 和拟纳入的新文件，不凭统计猜功能 |

上述例子是表达示范，不代表当前项目已提交这些修改或已执行测试。全局指令与原生生成规则属于模型指导，不是强制的 Git 格式校验。

### 安装

面板需要 Node.js 22+、Git 和支持 MCP Apps 的 Codex 桌面宿主。good-readme 辅助脚本另需 Python 3，缺失时可由 Codex 手动收集证据；开发时 `npm test` 中的技能资源测试需要 Python 3。无需配置预览地址、署名、浏览器或模型 API Key。

```sh
npm ci
npm run package
codex plugin marketplace add .
codex plugin add project-versions@project-versions-local
```

插件 ID 保持 `project-versions`，显示名为「Git 总览」，版本为 0.2.7。安装包是 `release/project-versions-0.2.7.zip`，运行时不需要 node_modules。

本地插件安装或更新后，需要用新会话加载工具；桌面宿主没有更新本地内容时需重新启动应用。参考 [官方插件文档](https://learn.chatgpt.com/docs/plugins) 与 [本地插件打包说明](https://developers.openai.com/plugins/build/plugins)。CLI 的安装结果与 MCP Apps 测试宿主不等于 Codex 原生面板验收，具体结果见 `docs/verification.md`。

### 只读范围

以下范围针对面板和 MCP 服务；配套技能通过 Codex 宿主工具执行的文档编辑与 Git 收尾见上文。

- 面板和 MCP 服务不初始化、暂存、提交、切换、合并、恢复或 fetch，不提供这些写入工具。
- Git 通过 GIT_OPTIONAL_LOCKS=0 运行读取命令；关闭 fsmonitor、外部 diff 和 textconv，禁止自动延迟 fetch。
- 当前查看工作树与其他工作树的分支占用分开展示；未选中的工作树仅列路径和引用，选择后才读取该目录的 HEAD 与未提交修改。
- 浅克隆边界有明确标记；缺失历史不会显示为真实根提交。
- 默认每批 100 条提交，可继续加载，支持按 HEAD 定位到历史窗口。游标关联引用快照，分支变化后需刷新。
- 超过 1 MB 的文件及二进制文件按状态展示，长文本差异最多显示前 100,000 字符。
- 所有信息基于本机 Git 记录。断网仍可使用；远程领先/落后数量不代表刚从远端刷新。

0.1 版产生的普通 Git 提交和 `~/.local/share/project-versions/` 下的截图/元数据保留，0.2 版不读取、迁移或清除这些资料。

### 开发

```sh
npm run typecheck
npm run build
npm test
npm run test:ui
npm run dev -- /absolute/path/to/repository
npm run demo
```

开发服务器仅监听 127.0.0.1，控制台提供临时密钥地址。`demo` 在临时真实仓库中建立多条分支、合并、标签、远程记录和未提交修改，供界面审阅。

`npm test` 另覆盖技能清单与辅助资源、无 Git / Git 不可用场景、嵌套项目边界、暂存与未暂存状态、重命名、特殊文件名及索引不变性。可用 `PLUGIN_BUNDLE_DIR=/absolute/path/to/extracted/project-versions node --import tsx --test tests/skills.test.ts` 对解压包运行同一技能测试。它验证资源与脚本行为，不代表真实 Codex 会话中的自动选择或提交行为已经验收。

`test:ui` 使用开发依赖 Playwright 和本机 Chrome（也支持 Playwright Chromium），检查界面与仓库字节摘要。标准 MCP Apps 测试宿主还验证主题、工具和消息调用；不依赖真实 Codex 的测试结果单独标注。

### 实现与来源

TypeScript 本地 MCP 服务 + React 面板 + 按真实父子关系排布的 SVG 提交轨道。产品参考 [Oil Git](https://github.com/oil-oil/oil-git)，未复制其源码、图标或界面素材。运行依赖的许可证保存在 `dist/THIRD_PARTY_NOTICES.txt`。

随附 good-readme 改编自本机 Good README 技能，保留原始 [MIT 许可证及版权声明](skills/good-readme/LICENSE)。插件自身采用 [MIT 许可证](LICENSE)。

<a id="english"></a>
## English

Occasionally open the panel to see where your project stands.

View real Git commits and branch relationships in the Codex workspace: your current position, forks, merges, and uncommitted changes. Select a node for details; source diffs are read only after you select a file. Hand selected context to the current Codex chat when you need an explanation or an operation. The bundled good-readme and gitwork skills help Codex synchronize documentation, isolate task changes, and complete local commits.

### Recommended: open from a project chat

1. Open the target project in Codex and enter a chat belonging to that project.
2. Ask “Open the current project's Git overview.” Codex supplies the current chat's actual worktree root and chat identifier without manual path entry; a worktree chat keeps its own directory rather than substituting the main project directory.
3. View the panel. When reopening or switching projects, launch it again from the corresponding project chat.

If the chat has no project context, first open the project or explicitly supply the target project's absolute path. The plugin cannot determine the target repository from a projectless chat.

Starting with 0.2.5, the UI resource declares a preferred `fullscreen` display mode so that launching from chat can favor a separate host panel (a desktop tab panel). The chat still supplies the project path. This is a host preference, not a guarantee; the host determines the actual location. The host must reload the UI resource after an update; an older panel does not demonstrate the new behavior. Launching from an empty new tab is a separate entry point, with the path limitations below.

#### Current new-tab limitation

As of 2026-10-20, this machine's Codex host and plugin 0.2.4 produced these results:

| Entry point | Project path | Observed result |
| --- | --- | --- |
| Ask to open Git overview in a project chat | Supplied explicitly by Codex | Native panel connection verified; no manual entry |
| New tab → More tools → Open Git overview | No usable project directory supplied by this entry point | Path entry page; manual selection required |

The new-tab entry point calls the tool without arguments. The plugin attempts to read the host workspace directory, but this machine's call did not provide a usable directory and returned `projectRequired: true`. A successfully enabled plugin does not establish automatic project discovery at that entry point.

**Opening from chat once does not make later new tabs inherit that project.** The implementation does not persist a default project across panels. Continue using the project chat entry point to avoid path entry. With the new-tab entry point, enter the target Git folder's absolute path and click “Open project”.

The launch configuration's `cwd: "."` locates plugin service files; it is not the user project directory. Removing it to try inheriting the project directory previously prevented startup, so do not use that configuration change to solve path entry. This conclusion describes the tested host; the plugin already has logic for usable workspace context if a future host provides it. See the [verification record](docs/verification.md).

### Viewing and follow-up operations

1. Confirm that the project name and branch/directory in “View worktree” match your target. You can select another worktree in the same repository; this changes only the view, without checking out a Git branch.
2. All local branches are shown by default. Each node is a commit; “Worktree HEAD” marks the HEAD of the directory being viewed.
3. Select a branch to inspect its relationships and progress, or a commit to inspect its message and files. Uncommitted changes have a separate dashed entry.
4. “Show remote” displays locally recorded remote refs; it does not fetch updates.
5. “Hand to Codex” opens an editable request draft containing the selected object, project path, current branch, and HEAD. After you send it, Codex rechecks the actual state before acting. In an ordinary browser, you can copy the request.

State is read when opening, regaining focus, or refreshing manually. Filtering and locating branches only change the view.

For example, ask the handoff draft to explain a commit, compare a branch with the current one, or check the state before continuing work on a branch. The plugin passes context; Codex executes Git operations according to your request.

### Worktrees and chat context

Starting with 0.2.6, “View worktree” at the top lists branches and full directories of worktrees in the same repository. “Worktree HEAD” marks the selected directory's position. Worktrees share branches and commit history but have independent HEADs and uncommitted changes: seeing `Function` commits in the graph does not establish that the panel is reading the `Function` worktree.

The panel remains bound to the directory specified when opening; switching chats does not automatically rebind it. If the chat is on `Function` but the panel shows another worktree, select the matching directory or reopen from that chat. Changing the view updates HEAD, uncommitted changes, and Codex handoff context together, clearing old filters and details. A failed read preserves the original view. The existing MCP tools remain read-only; selecting a directory does not check out, stage, or commit.

### Bundled development completion skills

The plugin distributes three independent skills through `skills/`:

| Skill | Trigger and purpose |
| --- | --- |
| `project-versions` | Open the overview and inspect branches and commits; viewing and explanation do not trigger commits |
| `good-readme` | Check documentation impact after non-README project files change; create or synchronize README when needed |
| `gitwork` | Check the baseline, isolate task changes, exclude local artifacts, and complete local commits for actual project changes |

After implementation and verification, check README first, then review the complete diff and perform Git completion. Both skills prioritize the user and target project's `AGENTS.md`: preserve existing documentation language and organization, synchronize affected translations, and follow the project's commit language, types, and scope. Respect requests to leave changes uncommitted, draft a message only, or avoid Git. An ancestor repository is not treated as the current project repository. Auto-created standalone chat directories skip automatic Git completion; a managed worktree explicitly designated as the active project is supported.

**When triggered and applicable, gitwork creates local commits through Codex's host tools; it does not automatically push or rewrite history. good-readme may edit README.** The panel and MCP tools remain read-only. Codex performs modifications under the current chat's authorization and permissions. Skills are not background hooks; installation does not guarantee invocation on every task. Confirm that a new session has loaded the skills after installation. If personal skills with the same names also exist, run one coherent workflow to avoid duplicate checks or commits. This plugin does not overwrite or remove personal skills.

In a new session with the plugin loaded, explicitly ask “Use good-readme to check whether this change needs a README update” or “Use gitwork to check this project and complete Git for this task's changes.” For viewing only, continue asking to open the current project's Git overview.

good-readme includes `scripts/inspect_readme_context.py` and `references/readme-contract.md`, resolved relative to the installed skill directory. The helper requires Python 3; if unavailable, Codex can collect equivalent evidence using host tools. The script supports non-Git projects, identifies ancestor repositories, and does not modify README or the Git index.

To verify that the plugin versions actually handle documentation checks and local commits, see the [bundled skill verification guide](docs/skill-verification.md#english) for provenance checks, a complete request, and acceptance evidence.

### Troubleshooting

- **Project path entry page:** The entry point did not supply a project directory. Return to a project chat and ask to open Git overview, or provide an absolute path on that page. Repeated restarts cannot supply missing project context.
- **“Could not display” or persistent connection failure:** This is a startup or panel connection problem, unlike the path entry page. If an old service remains after installation or update, fully quit and reopen Codex, then launch from a project chat. If it still fails, ask Codex to inspect startup logs and the `check_project_versions_ready` receipt; “plugin enabled” alone does not prove a working connection.
- **Session expired:** When the panel has a worktree path, “Read again” creates a fresh session for that directory, preserves the chat identifier, and sends a new ready receipt. It does not reuse the expired ID or fall back to the main worktree. Recovery clears old filters and details. If the fresh connection also fails, the retry button is hidden and refresh is disabled, with instructions to reopen from the current chat. A connection error with no known project path also offers no ineffective retry control.
- **No commit graph:** Confirm that the project has Git commits. A repository with uncommitted files but no first commit has no commit nodes; the plugin does not create commits automatically.
- **Panel branch differs from the current chat:** Check the actual directory in “View worktree”. Select the chat's worktree or reopen from that chat; refresh only reads the panel's existing directory.
- **Graph unchanged after Codex operations:** Refresh the panel. Reopen it from the target project's chat to avoid reusing a panel for another project.

### Commit message conventions and automatic generation

The recommended default is an English type followed by a short Chinese subject, with a body only for complex changes. This makes commit purposes easy to scan in the graph; necessary details remain available by selecting a commit.

“Leave blank to generate automatically” in the desktop commit box belongs to the host Git feature. Git overview only displays existing messages verbatim. In the locally installed implementation, generation uses Settings → Git → Commit instructions, the draft, and change content. Large changes may be represented only by summary statistics, and the generation context says untracked files are excluded. Selecting “Include unstaged changes” does not prove the generator saw every new file. These are observations of the current installed version, not a compatibility guarantee for other versions.

#### Configuration and use

1. Open desktop Settings → Git → Commit instructions, paste the complete rules below, and save. This setting affects all projects on that desktop and is not written automatically by plugin installation.
2. Chat commits use the same rules from global `~/.codex/AGENTS.md`. New chats load global instructions according to host behavior; for an existing chat that has not loaded them, explicitly ask to follow these rules. More specific repository instructions may affect the result.
3. For simple changes with complete context, native generation can be used. For large changes, many new files, or mixed changes, first ask in chat: “Inspect the actual proposed diff and new files, draft a commit message using the shared conventions, and do not commit yet.” Review the draft before requesting a commit or pasting it into the native commit box.
4. A body or test section is not required for every commit. Never claim unperformed validation passed. Do not rewrite historical commits to improve messages.

Copyable rules are available in [commit-instructions.txt](docs/commit-instructions.txt). Computer-control access to desktop settings was denied, so **the user still needs to paste and save the setting manually**. Documentation of these rules does not mean the native setting has taken effect.

#### Copyable generation rules

The following shared Chinese instruction text is intentionally identical in both language sections and in the copyable file:

```text
生成 Git 提交说明时，默认遵循以下规则：

1. 标题采用“类型(可选范围): 中文说明具体变化”。类型保留英文，标题及按需补充的正文使用中文；代码标识、分支名和版本号保留原文。标题尽量不超过 50 个字符，不加句末句号。
2. 标题写清具体对象及发生的变化，优先描述能被后续阅读者理解的行为或结果。避免“更新代码”“优化体验”“修复问题”“完成任务”等空泛描述，也不要只罗列文件名。
3. 仅在有助于识别模块时填写范围，例如“分支图”“项目绑定”；不强制每次填写。
4. 根据实际变更目的选择一个主要类型：
   feat：新增功能或特性。
   fix：修复 bug、错误或不符合预期的行为。
   perf：不改变预期功能的性能优化；没有证据时不宣称性能提升。
   refactor：不改变预期功能或行为的代码结构调整。
   docs：文档修改。
   style：仅格式调整，例如缩进、分号和空格；不是 CSS 修改的通用类型。
   test：测试用例新增或修改。
   build：构建系统、打包或依赖项修改。
   revert：撤销已有提交，并在正文中指出被撤销的提交及原因（仅在信息已知时填写）。
   ci：持续集成、持续交付流水线配置修改。
   chore：确实不属于其他类型的维护工作，不作为万能分类。
   release：发布新版本，并写清实际版本号。
   workflow：除 CI/CD 外的工作流程、协作流程或自动化流程修改。
5. CSS 修改按目的选择 feat、fix、refactor 等类型，不能仅因修改 CSS 就归为 style。功能修改附带测试时按主要功能目的分类，不必强行拆开相关测试。
6. 简单修改只写短标题。复杂修改才在空行后补充简短正文，说明必要的原因、影响或实际验证结果；正文不得重复标题，不强制填满固定模板。
7. 以本次将提交的实际变更和明确需求为依据。在对话中执行提交前检查待提交 diff，以及拟纳入的新文件内容；不要把整个聊天中的计划、未实现功能或未纳入提交的内容写进去。上下文只有统计摘要或缺少文件内容时，不推测具体功能，不编造原因、用户需求、测试通过或性能收益，优先使用用户已明确提供的草稿信息。
8. 一次提交围绕一个主要目的。对话中发现互不相关的改动时先建议拆分；不能仅凭这一规则擅自提交、暂存或推送。仅请求生成说明时，只返回提交说明草稿。

标题示例：
fix(分支图): 修复远程分支标签文字重叠
feat(总览): 支持按分支筛选提交历史
docs: 补充新标签页打开时的项目路径限制
release: 发布 Git 总览 0.2.5
```

#### Classification and wording examples

| Actual change | Suggested subject or handling |
| --- | --- |
| Add history filtering by branch | `feat(总览): 支持按分支筛选提交历史` |
| Fix overlapping remote branch labels, including CSS changes | `fix(分支图): 修复远程分支标签文字重叠` |
| Change only indentation and semicolons | `style: 统一提交图组件的缩进与分号` |
| Document the new-tab path limitation only | `docs: 补充新标签页打开时的项目路径限制` |
| Add a feature and its tests | Describe the main feature with `feat`; no forced separate test commit |
| Change branch filtering and unrelated installation documentation | Suggest separate `feat` and `docs` commits, rather than grouping under `chore` |
| Only file-change statistics are available | Inspect the actual diff and proposed new files before describing behavior |

These are wording examples, not claims that the project contains those changes or that tests ran. Global instructions and native generation rules guide the model; they are not an enforced Git format validator.

### Installation

The panel requires Node.js 22+, Git, and a Codex desktop host supporting MCP Apps. The good-readme helper additionally requires Python 3, with manual evidence collection as a fallback; development skill-resource tests in `npm test` require Python 3. No preview URL, signature, browser, or model API key configuration is needed.

```sh
npm ci
npm run package
codex plugin marketplace add .
codex plugin add project-versions@project-versions-local
```

Plugin ID remains `project-versions`, display name is “Git 总览”, and version is 0.2.7. The package is `release/project-versions-0.2.7.zip`; runtime does not require node_modules.

After local installation or update, load tools in a new session; restart the desktop app if the host retains old content. See the [official plugin documentation](https://learn.chatgpt.com/docs/plugins) and [local packaging guide](https://developers.openai.com/plugins/build/plugins). CLI installation and MCP Apps test-host results do not establish native Codex panel acceptance; see `docs/verification.md` for actual results.

### Read-only scope

This section describes the panel and MCP service. Documentation edits and Git completion through Codex host tools are described in the bundled skills section above.

- The panel and MCP service do not initialize, stage, commit, switch, merge, restore, or fetch, and expose no such write tools.
- Git read commands use GIT_OPTIONAL_LOCKS=0, disable fsmonitor, external diff and textconv, and prohibit automatic lazy fetch.
- Branch occupancy of the viewed worktree and other worktrees is shown separately. Unselected worktrees expose only paths and refs; their HEAD and uncommitted changes are read after selection.
- Shallow boundaries are marked; missing history is not presented as a real root commit.
- Each batch defaults to 100 commits with continued loading and HEAD location. Cursors are tied to a ref snapshot; branch changes require refresh.
- Files over 1 MB and binary files are represented by status; text diffs display at most 100,000 characters.
- All data comes from local Git records. Offline use works; remote ahead/behind counts do not imply a recent fetch.

Ordinary Git commits and screenshots/metadata under `~/.local/share/project-versions/` from 0.1 are retained. Version 0.2 does not read, migrate, or remove them.

### Development

```sh
npm run typecheck
npm run build
npm test
npm run test:ui
npm run dev -- /absolute/path/to/repository
npm run demo
```

The development server listens only on 127.0.0.1 and prints a temporary key URL. `demo` builds a real temporary repository with branches, merges, tags, remote records, and uncommitted changes for UI review.

`npm test` also covers the skill manifest and resources, no Git / Git unavailable cases, nested project scope, staged and unstaged states, renames, unusual filenames, and index immutability. Run `PLUGIN_BUNDLE_DIR=/absolute/path/to/extracted/project-versions node --import tsx --test tests/skills.test.ts` against an extracted package. This validates resources and script behavior, not automatic selection or commit behavior in a real Codex session.

`test:ui` uses the Playwright development dependency and local Chrome (or Playwright Chromium) to check the UI and repository byte digests. The standard MCP Apps test host also checks themes, tools, and messaging. Results that do not use the actual Codex host are identified separately.

### Implementation and sources

A local TypeScript MCP service, React panel, and SVG commit lanes arranged by real parent relationships. Product inspiration: [Oil Git](https://github.com/oil-oil/oil-git); no source, icons, or UI assets were copied. Runtime dependency licenses are included in `dist/THIRD_PARTY_NOTICES.txt`.

The bundled good-readme skill is adapted from the local Good README skill, retaining its original [MIT license and copyright notice](skills/good-readme/LICENSE). The plugin's own license is [MIT](LICENSE).
