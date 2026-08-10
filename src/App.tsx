import "./App.scss";

import { Layout } from "antd";
import { Outlet, useNavigate } from "react-router-dom";
import React, { Suspense, lazy, useEffect, useState } from "react";

// 布局来自组件库。这几个组件此前是本项目的 src/layout/，2.0 起已收进 @hsu-react/ui，
// 本项目不再自己维护一份。走子路径引入：它们依赖 react-router / react-intl，而这两个
// 在组件库里是**可选** peerDependency，所以刻意没有从包根导出。
import HsuLayout from "@hsu-react/ui/es/layout";
import type { AccountAction, MenuType } from "@hsu-react/ui/es/layout";
// 改密弹窗懒加载：App 在入口图里，而 PwdChange 会用到 hsu-ui 的 FormItem，
// 而 FormItem 静态引入了全部字段渲染器（FormEditor→wangeditor、
// FormCodeMirror→codemirror、FilePreview→pdfjs、Spreadsheet→xlsx）。
// 静态导入它等于把这几个库钉进首屏，而用户点了顶栏「修改密码」才需要它。
const PwdChange = lazy(() => import("./pages/PwdChange"));
import RouterService from "./router/RouterService";
import { ADMIN_HOME } from "./router/router.config";
import { clearAllCookie } from "./services/Axios";
import { observer } from "mobx-react-lite";
import wsCache from "./utils/wsCache";
import LoginStore from "./pages/Login/LoginStore";
import { getUserInfo } from "@/utils/auth";
import { usePermissions } from "@hsu-react/ui";

const { Sider, Content } = Layout;

const App: React.FC = observer(() => {
  const { logout } = LoginStore;
  const { router } = RouterService;

  const { layout, headerTheme } = HsuLayout.ThemeStore;

  // Nav (header/sidebar) light/dark: light -> light, dark/theme-colored -> dark
  const navTheme: "light" | "dark" = headerTheme === "light" ? "light" : "dark";

  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [childrenItems, setChildrenItems] = useState<MenuType[]>([]);
  const { checkPermission } = usePermissions();

  useEffect(() => {
    // Collapse the menu when window width <=1440, expand when >1440; only auto-switch when crossing the breakpoint,
    // resizes within the breakpoint do not override the user's manual expand/collapse choice
    const mql = window.matchMedia("(max-width: 1440px)");
    const onBreakpointChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setCollapsed(e.matches);
    };

    onBreakpointChange(mql);
    mql.addEventListener("change", onBreakpointChange);

    return () => {
      mql.removeEventListener("change", onBreakpointChange);
    };
  }, []);

  const quit = () => {
    wsCache.clear();
    clearAllCookie();
    navigate(`/login`);
  };

  const menu: AccountAction[] = (
    [
      {
        title: "修改密码",
        icon: "fa-regular:edit",
        onclick: () => setPwdOpen(true),
        hasPermi: ["sys:user:updPwd"],
      },
      {
        title: "退出登录",
        icon: "ep:switch-button",
        onclick: () => logout(quit),
        danger: true,
      },
    ] as (AccountAction & { hasPermi?: string[] })[]
  ).filter((item) => checkPermission(item.hasPermi));

  return (
    <HsuLayout.Theme>
      <Layout id="App" className={headerTheme}>
        {/* 用户信息与站点标题原本由 Header 自己去读 @/utils/auth 与全局 Config，
            组件收进库之后不再认识这两样，改由这里注入 */}
        <HsuLayout.Header
          router={router}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          onChildItems={setChildrenItems}
          menu={menu}
          user={getUserInfo()}
          title={Config.title}
          smallTitle={Config.smallTitle}
        />
        <Layout className="body">
          {/* Left sidebar menu */}
          {["left", "mixed"].includes(layout) && (
            <Sider
              trigger={null}
              collapsible
              collapsed={collapsed}
              width={230}
              theme={navTheme}
            >
              <HsuLayout.Menu
                router={router}
                collapsed={collapsed}
                theme={navTheme}
                menuItems={layout === "mixed" ? childrenItems : undefined}
              />
            </Sider>
          )}

          <Layout className="content">
            {/* Content tab bar */}
            <HsuLayout.NavTabBar
              router={router}
              affixRouter={[ADMIN_HOME]}
              basePath={ADMIN_HOME}
            />

            {/* Content area */}
            <Content className="content-body">
              <Outlet />
            </Content>
          </Layout>
        </Layout>
      </Layout>

      {/* 只在真正打开时才拉这个 chunk，关着的时候连请求都不发 */}
      {pwdOpen && (
        <Suspense fallback={null}>
          <PwdChange
            open={pwdOpen}
            onCancel={() => setPwdOpen(false)}
            onOk={() => logout(quit)}
          />
        </Suspense>
      )}
    </HsuLayout.Theme>
  );
});

export default App;
