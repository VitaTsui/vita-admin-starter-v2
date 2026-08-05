import React, { useEffect, useMemo, useState, useCallback, useDeferredValue } from "react";

import RouterStore from "./RouterService";
import { observer } from "mobx-react-lite";
import { useRoutes } from "react-router";
import { AliveScope } from "react-activation";
import { ReloadContent } from "@/hooks/useReload";
import { PermissionsContent } from "@/hooks/usePermissions";
import { NavTabBarContent } from "@/hooks/useDropTab";
import { NavTabBarTitleContent } from "@/hooks/useSetTabTitle";
import { getAccessToken } from "@/utils/auth";
import { ConfigProvider as HsuConfigProvider } from "@hsu-react/ui";
import { get, post, del, put } from "@/services/Axios";

const Routes: React.FC = observer(() => {
  const { router, permissions } = RouterStore;
  // 菜单拉回来后 RouterService 会整体换掉路由表，而页面组件是懒加载的。
  // observer 的重渲染走 useSyncExternalStore，是一次**同步**更新——同步更新里挂起
  // 的组件会让 React 丢掉整棵树（"A component suspended while responding to
  // synchronous input"），表现为登录后整页白屏。useDeferredValue 把这次换表降级成
  // 非紧急更新，React 会保留当前画面直到新页面的 chunk 到位。
  const deferredRouter = useDeferredValue(router);
  const [id, setId] = useState<string>("");
  const [dropKey, setDropKey] = useState<string>("");
  const [tabTitles, setTabTitles] = useState<Record<string, React.ReactNode>>(
    {}
  );

  useEffect(() => {
    const path = window.location.pathname;
    const noAuthPaths = ["/", "/login"];
    if (!getAccessToken() && !noAuthPaths.includes(path)) {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    document.title = Config.title || document.title;
  }, []);

  const value = useMemo(() => {
    return { id, setId };
  }, [id, setId]);

  const permissionsValue = useMemo(() => {
    return { permissions };
  }, [permissions]);

  const dropTabValue = useMemo(() => {
    return { dropKey, setDropKey };
  }, [dropKey, setDropKey]);

  const setTabTitle = useCallback((key: string, title: React.ReactNode) => {
    setTabTitles((prev) => ({
      ...prev,
      [key]: title,
    }));
  }, []);

  const tabTitleValue = useMemo(() => {
    return { tabTitles, setTabTitle };
  }, [tabTitles, setTabTitle]);

  return (
    // Inject the permission and request implementations for @hsu-react/ui, used by library components (Button hasPermi, ImportForm, etc.)
    <HsuConfigProvider permissions={permissions} request={{ get, post, del, put }}>
      <ReloadContent.Provider value={value}>
        <NavTabBarContent.Provider value={dropTabValue}>
          <NavTabBarTitleContent.Provider value={tabTitleValue}>
            <PermissionsContent.Provider value={permissionsValue}>
              <AliveScope>{useRoutes(deferredRouter)}</AliveScope>
            </PermissionsContent.Provider>
          </NavTabBarTitleContent.Provider>
        </NavTabBarContent.Provider>
      </ReloadContent.Provider>
    </HsuConfigProvider>
  );
});

export default Routes;
