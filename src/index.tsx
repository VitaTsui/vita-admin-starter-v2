import "./install-object-has-own-polyfill";

import "./index.scss";
// hsu-ui global styles (antd look-and-feel overrides); project-specific additions live in local styles/antd-overload.scss
import "@hsu-react/ui/es/styles/antd-overload.scss";
import "./styles/antd-overload.scss";

import { BrowserRouter } from "react-router-dom";
import Internationalization from "./layout/I18n";
import ReactDOM from "react-dom/client";
import Routes from "./router/Routes";

import { SingleRouter } from "@hsu-react/single-router";

import { addCollection, IconifyJSON } from "@iconify/react/dist/iconify.js";
import iconCollections from "./assets/iconify/collections.generated.json";

// 精简图标集：构建前由 scripts/genIconCollections.cjs 生成，取「源码里写死的」与
// 「菜单配置里用到的」（scripts/extraIcons.cjs）并集，整包几十 KB
// —— 完整图标集有几百 MB，整集注册会全部进首屏。
//
// 这里不再无条件异步预加载 IconSelect 那四套整集（约 1.9 MB）：菜单图标已经随
// 首屏就位，不必等；而且菜单图标很容易溢出那四套的范围，预加载既贵又盖不全。
// 漏网的图标由 utils/ensureIcons 在拿到菜单数据时按需补，见 RouterService.getMenuList。
(iconCollections as unknown as IconifyJSON[]).forEach((collection) => {
  addCollection(collection);
});

// 这里从前挂着全局 ChakraProvider + CacheProvider，把 @chakra-ui/react + @emotion/*
// + zag-js（约 570 KB）无条件带进首屏，而真正用到 chakra 的只有 Button.Chakra。
// hsu-ui 0.0.23 起这两层已收进 ChakraButton 自带的 ChakraRoot，跟着它的异步 chunk 走，
// 入口不再需要。若某个页面要直接使用 chakra 组件（不经 Button.Chakra），
// 从 @hsu-react/ui 引 ChakraRoot 在那个页面自行包一层即可。

ReactDOM.createRoot(document.getElementById("root")!).render(
  // v7_startTransition：把路由状态更新包进 startTransition。
  // 页面是懒加载的（见 RouterService 的 require.context "lazy"），而点击菜单/登录
  // 按钮触发的导航属于「同步输入」——React 18 遇到同步更新里挂起的组件会直接用
  // fallback 替换整棵树并抛 "A component suspended while responding to synchronous
  // input"，表现为点完按钮整页白屏。开了这个 flag 后 React 会保留当前画面直到新
  // chunk 到位。
  <BrowserRouter future={{ v7_startTransition: true }}>
    <SingleRouter showPath={false}>
      <Internationalization>
        <Routes />
      </Internationalization>
    </SingleRouter>
  </BrowserRouter>,
);
