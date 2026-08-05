---
name: upstream-lib-change
description: Use this skill when a fix or improvement belongs in one of the sibling libraries rather than in this project — @hsu-react/ui (hsu-ui)、hsu-utils、@hsu-react/single-router。CLAUDE.md 规定「组件能力不满足需求时，改动回 hsu-ui 仓库发版，再升级本项目依赖；不要在本项目内 fork/覆写组件」，本 skill 就是那条规定的执行细则：怎么定位仓库、怎么在消费方验证收益、版本号怎么动、PR 走什么流向、发版后怎么收尾。Typical triggers: 「去 hsu-ui 改」「回组件库修」「这个应该改库里」「改完发个版」「升级组件库依赖」「首屏体积追到组件库了」「组件库的 bug」, or any conclusion that the root cause sits in node_modules/@hsu-react/* or node_modules/hsu-utils rather than in src/. Skip when the fix genuinely belongs in this project's own code.
---

# 上游库改动与发版

CLAUDE.md 只说了「改回 hsu-ui 仓库发版」，没说怎么做。本 skill 补齐流程。

## 先决条件

三个库都在本机、与本项目平级：

```
/Users/<user>/Desktop/Program/VitaHsu/
├── hsu-ui/          → @hsu-react/ui        （dumi 文档站 ＋ father bundless 构建）
├── hsu-utils/       → hsu-utils            （tsc es/cjs ＋ webpack umd，有 jest 测试）
├── single-router/   → @hsu-react/single-router
└── <你的项目>/            ← 消费方（本模板起的项目）
```

三个库都是 `develop` 开发、`main` 发布，`.github/workflows/` 下有：

- `branch-flow.yml` —— **`main` 只接受来自 `develop` 的 PR**，其它流向直接 fail
- `release.yml` —— push 到 `main` 触发，读 `package.json` 的 version，tag/npm 上已存在则跳过，否则 `npm publish`（用仓库的 `NPM_TOKEN`）＋ 打 tag ＋ 生成 Release

**所以发版方式是「合 PR 到 main」，不是本地 `npm publish`。**本地也没有 npm 登录态，手动发会 401。

## 流程

### 1. 确认根因真在库里

先把引用链追到底再动手，不要凭直觉。首屏体积类问题用 webpack stats：

```bash
npx webpack --config config/webpack.config.cjs --env production --json > /tmp/s.json
# 然后在 stats 里沿 reasons 向上回溯，找到 ./src/ 边界
```

**追到的第一跳往往不是根因。**真实案例：pdfjs 进首屏，第一次追到 hsu-ui 的 `PdfPreview`，改完还在；第二次追到 hsu-utils 的 barrel，改完**还在**；第三次才发现是本项目 `Axios.ts` 深引了 `hsu-utils/lib/DownloadFile`（CJS 产物）。每次都要重新量，不要假设上一次的结论还成立。

### 2. 改库并本地构建

```bash
cd ../../hsu-ui && npx tsc --noEmit -p tsconfig.json && npm run build
# hsu-utils / single-router 用 yarn build，且有测试：yarn test
```

hsu-ui 没配 eslint，别去跑；hsu-utils 有 232 个单测，必须过。

### 3. 在消费方验证收益（关键，别跳）

**把本地构建产物换进消费方 node_modules，实测 A/B。**改完库直接发版、指望"应该会好"是这一轮踩过最贵的坑。

```bash
cd <消费方项目>
cp -r node_modules/@hsu-react/ui /tmp/hsu-ui-backup          # 先备份
rm -rf node_modules/@hsu-react/ui/{es,lib}
cp -r ../../hsu-ui/{es,lib} node_modules/@hsu-react/ui/
npm run build && <量首屏>
```

量首屏的口径（本项目 webpack ＋ HtmlWebpackPlugin）：

```bash
n=$(grep -o 'static/js/[^"]*\.js' dist/index.html | wc -l)
gz=0; for f in $(grep -o 'static/js/[^"]*\.js' dist/index.html); do
  gz=$((gz+$(gzip -c "dist/$f" | wc -c))); done
echo "$n 个 script | gzip $((gz/1024)) KB"
```

**必须测「最坏情况消费方」。**如果本项目已经在应用侧绕开了这个问题（比如把某组件改成懒加载躲开重依赖），那库里修没修都量不出差别。要**临时把那个绕行改回去**，才看得到库改动的真实收益。验完记得还原。

**每一处改动都单独验证必要性，没收益的回退。**这一轮试过两个方案——给 hsu-ui 加 `sideEffects: false` 的 webpack 规则、把 13 个入口文件改深路径导入——实测都是 0 收益，全部回退了。留着它们只会让后人以为是必要的。

### 4. 版本号与依赖范围

版本号在**同一个提交**里改（仓库惯例，commit message 末尾带「版本 x.y.z」）。发版流水线读的就是它，忘了改会静默跳过发布。

**semver 陷阱（必踩，这一轮多花了一整轮发版）**：`^0.0.x` 在 semver 里**等价于精确锁定**——0.0.z 被视为随时可能破坏。所以：

```jsonc
// ❌ hsu-ui 里这么写，hsu-utils 发了 0.0.56 也拿不到
"hsu-utils": "^0.0.55"
```

npm 会给 hsu-ui 装一份**嵌套的 hsu-utils@0.0.55**，消费方自己升到 0.0.56 完全没用——修复被嵌套副本挡住。现象是「库改了、也发版了、消费方也升了，但问题一点没变」。

```bash
# 自查：同一个包在依赖树里有几份
find node_modules -name "hsu-utils" -maxdepth 4 -type d
```

写成区间才能让补丁被提升去重：

```jsonc
"hsu-utils": ">=0.0.56 <0.1.0"
```

**改了底层库（hsu-utils），要连带检查谁依赖它**——hsu-ui 和 single-router 都依赖 hsu-utils，两个都得放宽范围并各发一版，否则等于没改。发版顺序按依赖方向：hsu-utils → single-router → hsu-ui。

### 5. PR ＆ 合并

```bash
git push origin develop
gh pr create --base main --head develop --title "…" --body "…"
gh pr merge <N> --merge          # 必须 merge commit，不能 squash
```

- **不能 squash**：`develop` → `main` 的发布流里 squash 会让两个分支分叉，后续每个 PR 都变脏。
- 刚开 PR 时 `branch-flow` 还在跑，`gh pr merge` 会拒绝并提示加 `--auto`。**别加 `--auto` 也别加 `--admin`**，等检查跑完再合：
  ```bash
  until [ "$(gh pr view <N> --json mergeStateStatus -q .mergeStateStatus)" = "CLEAN" ]; do sleep 5; done
  ```
- **合并到 main 就是对外发布**。除非用户明确说了「合并 / 发版」，否则只开 PR、把合并留给用户。

### 6. 跟到发版结果，别只看 CI 绿灯

```bash
rid=$(gh run list --workflow=release.yml --branch=main --limit=1 --json databaseId -q '.[0].databaseId')
gh run watch "$rid" --exit-status
npm view @hsu-react/ui version        # ← 从 npm 侧核实
```

### 7. 升级消费方并复验

```bash
npm install --legacy-peer-deps        # 若项目存在 peer 冲突（如 @ant-design/x × antd），装不上时才加这个标志
find node_modules -name "hsu-utils" -maxdepth 4 -type d   # 确认无嵌套副本
npx tsc --noEmit && npm run build && <量首屏>
```

**`npm install` 之后必须重启 dev server。**装包过程中 webpack 的模块图与 fork-ts-checker 会读到半完成状态，报出一堆假错（`ENOENT: xxx/node_modules/dayjs`、`TS2305: 没有导出成员 X`），而 `tsc --noEmit` 和 `npm run build` 是干净的。**以后两者为准**，重启 dev server（必要时 `rm -rf node_modules/.cache`）即可消失。

## 改库时的两条设计原则

### dispatcher 不得静态引用重实现

`FormItem`（按 `type` 分发）、`FilePreview`（按 `fileType` 分发）这类分发器会被大量页面引入，**静态 import 全部实现 = 所有消费方为最重的那个买单**。用 `React.lazy` ＋ 组件内自带 `Suspense`（使用方零改动），类型走 `import type`。

**修 dispatcher，不要逐个改它的引用方。**真实弯路：为了把 `FilePreview` 挡在首屏外，先改 `FormImage` 懒加载它 → 发现 `Upload` 也引 → 改完发现 `UploadedItem` 还引……这是打地鼠。回退，直接在 `FilePreview` 内部把重格式 lazy 掉，一次解决所有引用方，将来多一个引用方也不会回归。

配套：hook 不能写在 switch 分支里。若某分支要用 hook（如 `useXlsxData`），把「取数 ＋ 渲染」收进一个子组件整块 lazy，否则 hook 留在顶层照样把重依赖静态拖进来。

### 库里不要有模块级副作用

```ts
// ❌ hsu-utils/RenderPDF 曾经这样
import { GlobalWorkerOptions } from 'pdfjs-dist/…'
GlobalWorkerOptions.workerSrc = '…'      // 模块级赋值
```

这句让整个模块**永远无法被 tree-shaking 摇掉**，`sideEffects: false` 也救不回来。把它挪进动态 import 的回调里。

同理，工具库内部**不要反过来从自己的 barrel 取依赖**（`import { Typeof } from '..'`）——会形成 `barrel → 工具 → barrel` 回路，导致**深引任何一个工具都把整个 barrel 拉回来**，按需引入完全失效。改为直接引具体模块路径。

## 加防回归约束，而不是只修一次

这类问题**没有任何信号**：不报错、不慢一点点，只是所有消费方首屏悄悄变大，往往几个月后才被发现。修完要留下守卫，否则下一个人静态引一次就全部回退。

hsu-ui 里已有 `scripts/check-heavy-deps.cjs`：沿 `es/` 产物的**静态** import 图 BFS，命中重型依赖黑名单即失败并打印完整引用链，接进 `build` 与 `prepublishOnly`——**谁再静态引就发不出版**。

新增重组件时把它的重依赖加进那份黑名单。守卫的局限也要知道：**不穿透三方包**（`hsu-utils` 的 `RenderPDF → pdfjs` 就看不见），那类只能靠在消费方量首屏兜底。

**守卫写完一定要自测它真的会失败**——把某处 lazy 改回静态 import，确认被拦下。一个从不报警的守卫等于没有。这一轮守卫刚写完就抓出了一条手工挑漏的重依赖链，那正是它的价值。
