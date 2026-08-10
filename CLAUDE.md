# 项目规范（每次会话必读）

## UI 组件选用优先级（硬性规则）

1. **一律优先从 `@hsu-react/ui` 导入**：`Button`、`Icon`、`Table`、`FormItem`、`Form`（含 `Form.Modal`）、`Panel`（`List`/`Default`/`List.Modal`）、`Search`、`Operate`、`Switch`、`Select`、`Input`、`Checkbox`、`DatePicker`、`Tree`、`Tags`、`Modal`、`Descriptions`、`TextEllipsis`、`Copy`、`Upload`、`TabBar`、`Slider`、`FlexFill`、`Chart`、`Markdown`、`CodeMirror`、`Editor`、`FilePreview`、`Spreadsheet`、`ChainGraph`、`Chat` 等。
2. hsu-ui 没有的能力才用 antd 兜底（如 `message`、`notification`、`Popover`、`Tooltip`、`Divider`、`Segmented`、`Spin`、`Empty`）。
3. **禁止**用 antd 同名组件替代 hsu-ui 已有组件（antd 的 `Table`/`Modal`/`Switch`/`Select`/`Button` 等都不允许直接用）。拿不准先查 `node_modules/@hsu-react/ui/es/index.d.ts` 的导出或文档站 <https://vitatsui.github.io/hsu-ui>。

组件能力不满足需求时，改动回 hsu-ui 仓库发版，再升级本项目依赖；不要在本项目内 fork/覆写组件。具体怎么改、怎么在消费方验收益、版本号与依赖范围怎么动、PR 走什么流向、发版后怎么收尾，见 `upstream-lib-change` skill（同样适用于 hsu-utils 与 single-router）。

### 几个反直觉点（都踩过）

**`Button` 的 `title` 是 children 的兜底，不是原生 tooltip。**内部渲染的是 `children ?? title`，给图标按钮写 `title="改章号"` 会把这三个字**当内容渲染出来**，图标旁多出一截文字、把同一行的其它内容挤没。要悬浮提示就包一层 antd `Tooltip`：

```tsx
<Tooltip title="改章号">
  <Button type="text" size="small" icon={<SwapOutlined />} onClick={...} />
</Tooltip>
```

**`Input.TextArea` 里层 textarea 的样式要走 `textAreaClassName`，且部分属性要 `!important`。**`resize` / `font-size` / `line-height` 与 `.ant-input` 同为单类选择器、且组件库样式加载在后，不加 `!important` 会被盖掉（实测写了 `resize: none` 仍留着拖拽手柄、行高仍是 antd 默认值）。改完去浏览器量 computed style，别只看源码。

**`message` / `notification` 从 `@hsu-react/ui` 引，不要从 antd。**antd 的静态方法在 React 树外调用，读不到 `ConfigProvider` 注入的主题，控制台会明说：`Static function can not consume context like dynamic theme`。组件库导出的同名代理输出落在树内，签名与 antd 完全一致，只需改 import。另外 antd v6 把 `notification` 的 `message` 属性改名成了 `title`。

**antd v6 的语义化槽位换了名字。**`Tooltip` / `Popover` 的 `styles.body` 已不存在，改成 `container`（DOM 上对应 `.ant-popover-inner` → `.ant-popover-container`）。照 v5 写不会报错，只是规则永远不生效。

## 页面 / 接口 / 选项 / 菜单开发

创建或修改相应内容时，先调起 `.claude/skills/` 下的项目级 skill 并遵循其规范：

- `page-creation`：`src/pages/` 下任何页面的创建/修改/审查
- `api-creation`：`src/services/apis/` 下接口模块
- `options-management`：`OptionsStore` 下拉/枚举选项
- `menu-function-management`：运行中应用的菜单/功能管理
- `playwright-mcp-strategy`：前端源码改动与浏览器验证
- `upstream-lib-change`：根因在 hsu-ui / hsu-utils / single-router 时的改动与发版

## 布局与通用 hooks

- **布局来自组件库，本项目不再有 `src/layout/`。**顶栏、菜单、面包屑、页签栏、外观、国际化六个组件都在 `@hsu-react/ui/es/layout`，走子路径引入（它们依赖 react-router / react-intl，在库里是可选 peerDependency，刻意没从包根导出）：

  ```ts
  import HsuLayout from "@hsu-react/ui/es/layout";
  import type { AccountAction, MenuType, RouteType, MetaType } from "@hsu-react/ui/es/layout";
  ```

  `App.tsx` 只剩壳、Sider、Content 和改密弹窗。顶栏要用页面侧的东西（`LoginStore`、懒加载的 `PwdChange`）时**倒过来注入**——`Header` 只收 `menu: AccountAction[]`，不 import `@/pages/…`。理由与代价见 `page-creation` skill 的「页面是懒加载的」一节。用户信息与站点标题同理，由 `App.tsx` 用 `user` / `title` / `smallTitle` 传进去。

- **页签体系的 context 必须用组件库那份**（`ReloadContent` / `NavTabBarContent` / `NavTabBarTitleContent`，以及 `useReload` / `useSetTabTitle` / `useDropTab`）。本项目曾经在 `src/hooks/` 下有一份逐字相同的副本，`Routes.tsx` 挂的是本地那份、而 `NavTabBar` 读的是库里那份——两边各挂各的，页签标题/刷新/关闭**静默失效**，不报任何错。已删除，不要再建。

- 同理，`usePermissions` / `PermissionsContent` 用 `@hsu-react/ui` 的；权限 context 由 `ConfigProvider` 提供，不要再自己挂一层 Provider。`RouteType` / `MetaType` 从组件库转出（`@/router/router.config` 仍可引），只有一处真源。

## 纯页面内状态不要持久化

面板折叠、视图切换（卡片/列表）、展开收起这类**只影响当前这一眼怎么看**的状态，用 `useState` 就够，**不要写进 localStorage**：

- 页签是 KeepAlive 缓存的，切走再回来状态本来就还在，持久化并不解决任何实际问题；
- localStorage 的 key 是**全局**的，而这些状态几乎都是「针对当前这个对象」的——下游项目真踩过：某个折叠态被所有作品所有章共享、另一个被所有角色共享，换一个对象还顶着上一个的折叠状态；
- 真正该跨会话记住的（登录态、主题、语言、每页条数）走 `wsCache`，那是另一回事。

判据：**这个状态换一个对象/换一个页签还成立吗？**不成立就是页面内状态。

## 技术栈约定

- React 18 + TypeScript + MobX + webpack 5 + **antd v6** + `@hsu-react/ui@^2`（2.x 是 antd v6 线；antd v5 请用 `@hsu-react/ui@1`，那条线在 [VitaTsui/hsu-ui](https://github.com/VitaTsui/hsu-ui)）
- 样式一律 scss（`.module.scss`），项目内零 less
- 列表页 store 继承 `ListPanelStore`、表单 store 继承 `FormModalStore`（`src/stores/basisStoreClass/`）
- 入口 `src/index.tsx` 引入组件库全局样式 `@hsu-react/ui/es/styles/antd-overload.scss`；项目特有的 antd 覆盖增量放本地 `src/styles/antd-overload.scss`（在其后引入），不要整份拷贝组件库样式
