import "./App.scss";

// Only components hsu-ui does not provide fall back to antd; Button comes from hsu-ui
import { Avatar, Layout, Popover, Segmented, Space } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate } from "react-router-dom";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { getUserInfo } from "./utils/auth";

import Breadcrumb from "./layout/Breadcrumb";
import { Button, Icon } from "@hsu-react/ui";
import Menu, { MenuType } from "./layout/Menu";
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
import NavTabBar from "./layout/NavTabBar";
import LoginStore from "./pages/Login/LoginStore";
import ThemeStore from "./layout/Theme/ThemeStore";
import classNames from "classnames";
import Theme from "./layout/Theme";
import I18nStore from "./layout/I18n/I18nStore";
import usePermissions from "@/hooks/usePermissions";

const { Header, Sider, Content } = Layout;

const App: React.FC = observer(() => {
  const { logout } = LoginStore;
  const { router } = RouterService;

  const { layout, headerTheme, appearance, setAppearance } = ThemeStore;
  const { locale, setLocale } = I18nStore;

  // Appearance + language are grouped into the user dropdown; bilingual labels follow the current language
  const isEn = locale === "en-US";
  const appearanceOptions = [
    { label: isEn ? "Light" : "浅色", value: "light" },
    { label: isEn ? "Dark" : "深色", value: "dark" },
    { label: isEn ? "System" : "跟随", value: "system" },
  ];
  const languageOptions = [
    { label: "中文", value: "zh-CN" },
    { label: "English", value: "en-US" },
  ];

  // Nav (header/sidebar) light/dark: light -> light, dark/theme-colored -> dark
  const navTheme: "light" | "dark" =
    headerTheme === "light" ? "light" : "dark";

  const { nickname } = getUserInfo();
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

  const menu = [
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
    },
  ].filter((item) => checkPermission(item.hasPermi));

  return (
    <Theme>
      <Layout id="App" className={headerTheme}>
        <Header className={classNames("header", headerTheme)}>
          <div className="header-left">
            {/* Title */}
            {["left", "mixed"].includes(layout) ? (
              <div
                className={classNames("title", { titleCollapsed: collapsed })}
              >
                {collapsed ? Config.smallTitle : Config.title}
              </div>
            ) : (
              <div className={classNames("title", "titleTop")}>
                {Config.title}
              </div>
            )}

            {/* Collapse button */}
            {["left", "mixed"].includes(layout) && (
              <Button
                className="collapsed"
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: "16px",
                  width: 64,
                  height: 64,
                }}
              />
            )}

            {/* Breadcrumb */}
            {["left"].includes(layout) && (
              <Breadcrumb router={router} className={"breadcrumb"} />
            )}

            {/* Top menu */}
            {["top", "mixed"].includes(layout) && (
              <Menu
                router={router}
                mode="horizontal"
                theme={navTheme}
                onlyLvOneMenu={layout === "mixed"}
                getCurrChildItems={setChildrenItems}
              />
            )}
          </div>
          <div className="header-right">
            {/* User info (appearance + language + account actions, all grouped in this dropdown) */}
            <Popover
              overlayClassName="userPopover"
              placement="bottomRight"
              content={
                <div className="userMenuPanel">
                  <div className="settingRow">
                    <span className="settingLabel">
                      {isEn ? "Appearance" : "外观"}
                    </span>
                    <Segmented
                      size="small"
                      value={appearance}
                      options={appearanceOptions}
                      onChange={(v) => setAppearance(v as typeof appearance)}
                    />
                  </div>
                  <div className="settingRow">
                    <span className="settingLabel">
                      {isEn ? "Language" : "语言"}
                    </span>
                    <Segmented
                      size="small"
                      value={locale}
                      options={languageOptions}
                      onChange={(v) => setLocale(v as string)}
                    />
                  </div>

                  <div className="settingDivider" />

                  <div className="menu">
                    {menu?.map((item, index) => (
                      <Button
                        key={index}
                        icon={<Icon icon={item.icon} />}
                        onClick={item.onclick}
                        type="text"
                      >
                        {item.title}
                      </Button>
                    ))}
                  </div>
                </div>
              }
            >
              <Space className="user">
                <Avatar
                  style={{ backgroundColor: "#1677ff", verticalAlign: "middle" }}
                  icon={nickname ? undefined : <UserOutlined />}
                >
                  {nickname?.[0]?.toUpperCase()}
                </Avatar>
                {nickname}
              </Space>
            </Popover>
          </div>
        </Header>
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
              <Menu
                router={router}
                collapsed={collapsed}
                theme={navTheme}
                menuItems={layout === "mixed" ? childrenItems : undefined}
              />
            </Sider>
          )}

          <Layout className="content">
            {/* Content tab bar */}
            <NavTabBar
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
    </Theme>
  );
});

export default App;
