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

import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";

const cache = createCache({
  key: "css",
  prepend: true,
});

const system = createSystem(defaultConfig, {
  disableLayers: true,
  preflight: false,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  // v7_startTransition：把路由状态更新包进 startTransition。
  // 页面是懒加载的（见 RouterService 的 require.context "lazy"），而点击菜单/登录
  // 按钮触发的导航属于「同步输入」——React 18 遇到同步更新里挂起的组件会直接用
  // fallback 替换整棵树并抛 "A component suspended while responding to synchronous
  // input"，表现为点完按钮整页白屏。开了这个 flag 后 React 会保留当前画面直到新
  // chunk 到位。
  <BrowserRouter future={{ v7_startTransition: true }}>
    <SingleRouter showPath={false}>
      <CacheProvider value={cache}>
        <ChakraProvider value={system}>
          <Internationalization>
            <Routes />
          </Internationalization>
        </ChakraProvider>
      </CacheProvider>
    </SingleRouter>
  </BrowserRouter>,
);
