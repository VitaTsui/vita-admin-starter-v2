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

// 源码里写死的图标：构建前由 scripts/genIconCollections.cjs 扫描生成，
// 只含实际用到的十几个（完整图标集有几百 MB，整集注册会全部进首屏）。
(iconCollections as unknown as IconifyJSON[]).forEach((collection) => {
  addCollection(collection);
});

// 菜单图标由后端下发，取值范围是 hsu-ui IconSelect 提供的四套图标集，静态分析拿不到。
// 启动后异步补齐，不占首屏体积；Iconify 会在集合到位后自动重绘已挂载的图标。
// 这里的 import() 路径与 IconSelect 内部完全一致，webpack 会复用同一批 chunk。
void Promise.all([
  import("@iconify/json/json/ant-design.json"),
  import("@iconify/json/json/ep.json"),
  import("@iconify/json/json/fa.json"),
  import("@iconify/json/json/fa-solid.json"),
]).then((modules) => {
  modules.forEach((module) => {
    addCollection((module.default ?? module) as unknown as IconifyJSON);
  });
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
