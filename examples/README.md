# Gitview体验项目

运行 `npm run demo` 会在系统临时目录创建真实 Git 项目，并打开本地开发服务。数据来自实际提交、分叉、合并、标签、远程引用与未提交文件，未使用静态图数据。

仓库结构由 tests/fixture.ts 构造，包含 main、codex/component-gallery、codex/design-sync、codex/code-onboarding、指向同一提交的另一个本地分支，以及远程独有分支。它是体验与测试资料，不会修改当前源码仓库。
