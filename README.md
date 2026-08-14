# Vita Admin Starter

[![license](https://img.shields.io/github/license/VitaTsui/vita-admin-starter-v2.svg)](./LICENSE)

一套开箱即用的**中后台管理脚手架**。
UI 主要基于 [`@hsu-react/ui`](https://www.npmjs.com/package/@hsu-react/ui) 组件库构建，
配合 React 18 + TypeScript + MobX，使用 webpack 5 打包。
（`@hsu-react/ui` 在 Ant Design 5 之上做了二次封装，antd 作为底层依赖少量场景直接使用。）

内置动态路由（后端菜单驱动）、权限控制、多标签页、主题切换、国际化、服务层封装、
MobX store 基类（列表 / 表单 / CRUD）、通用组件库，以及页面脚手架生成器 —— 可直接作为新项目的起点。

> 内置系统管理示例页（权限、日志、字典、文件等），方便在此之上叠加自己的业务。

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 框架 | React 18、React Router 6 |
| 语言 | TypeScript 5 |
| 状态管理 | MobX 6 + mobx-react-lite |
| UI 组件库（主） | **`@hsu-react/ui`** —— Panel / Form / Table / Search / FormItem / Operate / Chart / Markdown 等业务组件，页面主要由它搭建 |
| UI 底层（次） | Ant Design 5 —— `@hsu-react/ui` 的底层依赖；少量基础元素（Button / Tag / Switch 等）按需直接使用 |
| 可视化 | ECharts、AntV G6、ReactFlow、zrender |
| 富文本 / 编辑器 | TipTap、wangEditor、react-markdown、CodeMirror |
| 表格 | x-data-spreadsheet、xlsx |
| 网络 | axios、@microsoft/fetch-event-source（SSE 流式） |
| 构建 | webpack 5、ts-loader、babel、less |
| 加密 | crypto-js、node-forge、@noble/ciphers（登录 RSA + AES） |

路径别名：`@/*` → `src/*`（见 `tsconfig.json` 与 `config/webpack.config.common.cjs`）。
组件统一**直接从 `@hsu-react/ui` 引入**。

## UI 组件库

项目页面**主要由 [`@hsu-react/ui`](https://www.npmjs.com/package/@hsu-react/ui) 搭建**——
列表页 `Panel.List`、内容 / 表单页 `Panel.Default` / `Form.Modal` / `FormItem`、
搜索 `Search`、操作列 `Operate`、表格 `Table`、图表 `Chart`、`Markdown` 等业务组件均来自它
（已基于 Ant Design 5 做二次封装并统一观感）。组件均直接从 `@hsu-react/ui` 引入：

```tsx
import { Panel } from "@hsu-react/ui";
import { FormItemProps } from "@hsu-react/ui";
import { Operate } from "@hsu-react/ui";
```

**Ant Design 5 作为底层依赖**，只在需要原生基础元素时按需直接使用：

```tsx
import { Button, Tag, Switch, message } from "antd";
```

> 组件文档与在线示例见 hsu-ui 官网：<https://vitatsui.github.io/hsu-ui>
> 组件能力的改动需回到 hsu-ui 仓库，发布新版本后再升级本项目的依赖。

## 环境要求

- Node.js 20+
- 包管理器：pnpm（由 package.json 的 `packageManager` 字段钉住版本，corepack 会自动取对）

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm start
```

默认监听 **3003** 端口（被占用时由 portfinder 自动顺延，终端会打印实际地址）。
启动前请在 `.env/.env.dev` 中把 `API_PROXY` 指向你的后端，并填好登录加密密钥。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm start` | 启动开发服务器（webpack-dev-server，HMR） |
| `pnpm build` | 生产构建（输出到 `dist/`） |
| `pnpm lint` | ESLint 检查（`--max-warnings 0`） |
| `pnpm gen:icons` | 生成精简图标集（`start` / `build` 已前置，一般不用手动跑） |
| `pnpm sync:menu-icons <菜单JSON>` | 把后端菜单里配置的图标固化成构建输入 |
| `pnpm crt:lp` | 生成列表页面（List Panel） |
| `pnpm crt:fp` | 生成表单页面（Form Panel） |
| `pnpm crt:lfp` | 生成「列表 + 表单」页面 |
| `pnpm crt:lmp` | 生成「列表内嵌弹窗子列表」页面 |
| `pnpm crt:dp` | 生成静态 / 内容页面（Default Panel） |

> `crt:*` 为页面脚手架，脚本在 `scripts/`，对应模板在 `scripts/{ListPanel,FormPanel,...}`。
> 这是本框架快速产出新页面的核心利器，强烈建议先熟悉。

## 图标（Iconify）

图标统一用 `@hsu-react/ui` 的 `<Icon icon="ant-design:home-outlined" />`。**不走 Iconify 在线 API**（内网 / 离线环境会全部不显示），而是在入口 `addCollection` 注册一份**按需裁剪**的图标集：`@iconify/json` 完整图标集有几百 MB，整集注册会全部进首屏，而实际用到的只有几十上百个。

图标有两个来源，都要进这份精简集：

| 来源 | 怎么进来 |
| --- | --- |
| 源码里写死的 | `gen:icons` 扫描 `src/**/*.tsx?` 里的 `"prefix:icon-name"` 字面量 |
| 后端菜单配置的 | `sync:menu-icons` 从菜单 JSON 提取 → `scripts/extraIcons.cjs` → 被 `gen:icons` 一并裁剪 |

菜单图标存在数据库、构建期扫不到源码，但必须**随首屏就位**，否则侧边菜单先空白一拍。所以菜单图标有增改时：

```bash
# 菜单 JSON 可以是 getMenuList 的响应，或后台导出的菜单配置
pnpm sync:menu-icons ./tmp/menu.json   # 更新 scripts/extraIcons.cjs
pnpm gen:icons                          # 裁进 collections.generated.json
```

`scripts/extraIcons.cjs` 与 `src/assets/iconify/collections.generated.json` 都是**生成物，但需要提交进仓库**，避免 CI 上没跑脚本导致编译失败；`start` / `build` 前置的 `gen:icons` 保证它不过期。

新增图标集时，要同时补两处：`scripts/genIconCollections.cjs` 的 `PREFIXES`（源码扫描白名单）和 `src/utils/ensureIcons.ts` 的 `LOADERS`（运行时兜底）。缺了后者 `gen:icons` 会提示。

`ensureIcons` 是兜底：`RouterService` 拿到菜单后检查图标是否已注册，**只对真正缺失的集合异步补一整套**。正常情况（图标都已裁进精简集）一个请求都不会发，兜的是「有人在菜单管理里配了新图标、前端还没重跑 `gen:icons`」。

验证图标时有两个坑：

- **别数 `<svg>` 个数**：Iconify 对未注册的图标照样渲染一个空 `<svg>`，数量对不代表画出来了。要看 `svg.children.length > 0`。
- **开发机上「看着正常」不算数**：集合缺失时 Iconify 会兜底去请求在线 API（`api.iconify.design`），有外网就悄悄补上了；同一份代码部署到内网 / 离线环境就是空白图标。要确认某个图标是不是真的进了精简集，翻 network 看有没有 `api.iconify.design` 的请求，或直接查 `collections.generated.json`。

## 环境变量

环境配置集中在 `.env/` 目录，由 webpack 在构建时注入：

| 文件 | 用途 |
| --- | --- |
| `.env.common` | 公共配置（如 CSS Modules 类名放行白名单 `PASS_CLS`） |
| `.env.dev` | 开发环境：端口、`/api` 代理目标、登录加密密钥 |
| `.env.prod` | 生产环境 |

`.env.dev` 关键项：

- `SERVER_PROT` — dev-server 端口（3003）
- `API_BASE` / `API_PROXY` — `/api` 反向代理到你的后端
- `CRYPTO_KEY` / `RSA_PUB_KEY` — 登录加密密钥，需与后端配置一一对应（**请替换为你自己的密钥**）

## 目录结构

```
vita-admin-starter-v2/
├─ .env/                 # 环境变量（common / dev / prod）
├─ config/               # webpack 配置（common / dev / prod 三段 merge）
├─ scripts/              # 页面脚手架生成器（crt:*）、图标裁剪（gen:icons / sync:menu-icons）
├─ public/               # 静态资源（config.js 含站点标题等运行时配置）
└─ src/
   ├─ assets/            # 图片 / 字体 / lottie 等
   ├─ hooks/             # 通用 hooks（权限 / 搜索 / 标签页等）
   ├─ layout/            # 布局（菜单 / 面包屑 / 标签栏 / 主题 / 国际化）
   ├─ pages/             # 页面（见下方模块说明）
   ├─ router/            # 动态路由配置、菜单驱动、路由守卫
   ├─ services/          # Axios 封装、接口定义（apis/）、返回类型
   ├─ stores/            # MobX store（OptionsStore、基类 basisStoreClass）
   ├─ styles/            # 全局样式
   └─ utils/             # 工具函数（auth / crypto / wsCache …）
```

### 页面模块（系统管理示例）

| 目录 | 模块 |
| --- | --- |
| `pages/Login`、`pages/PwdChange` | 登录、修改密码 |
| `pages/Overview` | 概览 / 首页（静态示例仪表盘，接入接口即可） |
| `pages/permit` | 权限：部门 Dept、菜单 Menu、角色 Role、用户 User |
| `pages/syslog` | 系统日志：API / 错误 / 任务 / 登录 / 操作 等日志 |
| `pages/sysmgmt` | 系统管理：字典 Dict、参数 Param、短信 sms |
| `pages/systool` | 系统工具：文件 File |

> 这些页面同时是「如何用本框架写业务页」的范例：列表 + 搜索 + 表单弹窗 + CRUD 的标准写法，
> 配合 `scripts/` 的脚手架生成器即可快速复制扩展。

## 路由说明

- 后台统一前缀 `/admin`，菜单由后端动态返回并挂载为子路由（见 `src/router/RouterService.tsx`）。
- 带路由参数、不在菜单中的详情页，在 `src/router/router.config.tsx` 中显式注册。
- 用 `adminPath("xxx/yyy")` 拼接后台路径，避免硬编码 `/admin` 前缀。

## 贡献

日常开发在 `develop` 分支进行（feature 分支合入 `develop`），`main` 只接受来自 `develop` 的 PR。PR 标题遵循 [Conventional Commits](https://www.conventionalcommits.org/)。

> 想直接用本模板创建新项目？推荐 [`create-vita-admin`](https://github.com/VitaTsui/create-vita-admin)：`npm create vita-admin@latest my-app`。

## License

[MIT](./LICENSE) © VitaHsu
