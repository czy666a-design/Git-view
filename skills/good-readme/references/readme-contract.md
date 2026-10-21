# README Contract

Read this reference when creating or restructuring a project README or repairing bilingual navigation. Follow the user and target repository language policy. Preserve an existing single-language README or separate translation files; the bilingual layout below applies only when Chinese/English sections in one file are requested or already used.

## Inclusion Rules

Always include content when repository evidence supports it:

1. Project name and one-sentence value statement
2. Language switch when translations exist
3. Overview
4. Core capabilities
5. Quick start
6. Usage
7. Development and verification commands
8. License or ownership status when present in the repository

Include conditionally:

- screenshots or demos only when usable assets exist;
- configuration when users can or must configure the project;
- project structure when it helps contributors navigate meaningful modules;
- API, CLI, routes, data model, architecture, deployment, troubleshooting, security, contributing, or roadmap only when the project actually exposes or documents them;
- badges only when their targets are real and stable.

Omit empty headings and guessed content. Prefer a shorter truthful README over a complete-looking fictional one.

## Canonical Order

Use the following order when it fits the project. For bilingual documents, keep both language sections aligned:

1. 项目简介 / Overview
2. 核心能力 / Features
3. 快速开始 / Quick Start
4. 使用方法 / Usage
5. 配置 / Configuration (conditional)
6. 项目结构 / Project Structure (conditional)
7. 开发与验证 / Development and Verification
8. API 或 CLI / API or CLI (conditional)
9. 部署 / Deployment (conditional)
10. 常见问题 / Troubleshooting (conditional)
11. 参与贡献 / Contributing (conditional)
12. 许可证 / License (conditional)

## Starter Template

The following is an optional Chinese/English template, not a requirement to add a language. For a single-language README, use only the relevant sections and omit language-switch links. Replace placeholders only with verified project facts. Remove any inapplicable section.

````markdown
# PROJECT_NAME

ONE_SENTENCE_VALUE_STATEMENT

[中文](#中文) | [English](#english)

---

<a id="中文"></a>
## 中文

### 项目简介

说明项目解决什么问题、面向谁，以及当前成熟度。

### 核心能力

- 能力一
- 能力二

### 快速开始

#### 环境要求

- REQUIREMENT

#### 安装

```sh
VERIFIED_INSTALL_COMMAND
```

#### 运行

```sh
VERIFIED_RUN_COMMAND
```

### 使用方法

给出最小可用示例和预期结果。

### 开发与验证

```sh
VERIFIED_TEST_OR_CHECK_COMMAND
```

### 许可证

LICENSE_STATUS

[English](#english) · [返回顶部](#project_name_anchor)

---

<a id="english"></a>
## English

### Overview

Explain the problem, audience, and current maturity.

### Features

- Capability one
- Capability two

### Quick Start

#### Prerequisites

- REQUIREMENT

#### Install

```sh
VERIFIED_INSTALL_COMMAND
```

#### Run

```sh
VERIFIED_RUN_COMMAND
```

### Usage

Provide the smallest useful example and its expected result.

### Development and Verification

```sh
VERIFIED_TEST_OR_CHECK_COMMAND
```

### License

LICENSE_STATUS

[中文](#中文) · [Back to top](#project_name_anchor)
````

## Synchronization Checklist

For every changed fact, compare both language sections:

| Fact class | Chinese | English |
| --- | --- | --- |
| Purpose and audience | Same scope | Same scope |
| Feature status | Same availability | Same availability |
| Commands and code | Byte-for-byte equivalent where practical | Byte-for-byte equivalent where practical |
| Environment and versions | Same names and constraints | Same names and constraints |
| Paths and links | Same targets | Same targets |
| Warnings and limitations | Same severity and scope | Same severity and scope |
| Verification status | Same evidence | Same evidence |

Headings may be idiomatic, but facts must not diverge.
