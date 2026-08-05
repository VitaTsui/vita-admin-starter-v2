import React from "react";

// Only components hsu-ui does not provide fall back to antd; Button comes from hsu-ui
import { Avatar, Layout, Popover, Segmented, Space } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Icon } from "@hsu-react/ui";
import classNames from "classnames";

import { observer } from "mobx-react-lite";

import Breadcrumb from "../Breadcrumb";
import Menu, { MenuType } from "../Menu";
import ThemeStore from "../Theme/ThemeStore";
import I18nStore from "../I18n/I18nStore";
import { getUserInfo } from "@/utils/auth";

/**
 * 账号动作（改密 / 退出）由 App 传进来，本组件只认这个形状、不认来源。
 *
 * 别把 `PwdChange` 或 `LoginStore` 搬进来——看着它们该跟用户菜单待在一起，
 * 但会同时踩两条：
 *   1. `layout/` 反向 import `@/pages/…`（共享层依赖页面私有目录）；
 *   2. `PwdChange` 用 `FormItem`，而 `FormItem` 静态引入全部字段渲染器
 *      （wangeditor / codemirror / pdfjs / xlsx）。它现在由 App 以 `lazy()`
 *      ＋「打开才挂载」持有，搬进来很容易顺手写成静态 import，那些库就又钉回首屏了。
 */
export interface AccountAction {
  title: string;
  icon: string;
  onclick: () => void;
}

interface HeaderProps {
  router: Parameters<typeof Breadcrumb>[0]["router"];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** mixed 布局下把顶部菜单的子项回传给左侧栏 */
  onChildItems: (items: MenuType[]) => void;
  menu: AccountAction[];
}

const Header: React.FC<HeaderProps> = observer((props) => {
  const { router, collapsed, onToggleCollapsed, onChildItems, menu } = props;
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
  const navTheme: "light" | "dark" = headerTheme === "light" ? "light" : "dark";

  const { nickname } = getUserInfo();

  return (
    <Layout.Header className={classNames("header", headerTheme)}>
      <div className="header-left">
        {/* Title */}
        {["left", "mixed"].includes(layout) ? (
          <div className={classNames("title", { titleCollapsed: collapsed })}>
            {collapsed ? Config.smallTitle : Config.title}
          </div>
        ) : (
          <div className={classNames("title", "titleTop")}>{Config.title}</div>
        )}

        {/* Collapse button */}
        {["left", "mixed"].includes(layout) && (
          <Button
            className="collapsed"
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapsed}
            style={{ fontSize: "16px", width: 64, height: 64 }}
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
            getCurrChildItems={onChildItems}
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
    </Layout.Header>
  );
});

export default Header;
