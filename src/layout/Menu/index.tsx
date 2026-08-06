import React, { ReactNode, useMemo } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";

import { Menu as AntdMenu, MenuProps as AntdMenuProps } from "antd";
import { ItemType } from "antd/es/menu/interface";
import { RouteType } from "@/router/router.config";
import { cloneDeep } from "lodash";
import classNames from "classnames";
import styles from "./index.module.scss";
import { formatMenu } from "./_utils/formatMenu";
import { setActiveIcon } from "./_utils/setActiveIcon";
import { useMenuPath } from "./_hooks/useMenuPath";
import SecondaryHeader from "./_components/SecondaryHeader";
import { useOnlyLvOneMenu } from "./_hooks/useOnlyLvOneMenu";

export type MenuType = ItemType & {
  key: string;
  icon?: ReactNode;
  defaultIcon?: ReactNode;
  activeIcon?: ReactNode;
  children?: MenuType[];
  label?: ReactNode;
  path?: string;
  name?: ReactNode;
  title?: string;
  disabled?: boolean;
  renderLabel?: (label: string) => ReactNode;
  parent?: MenuType;
};

interface MenuProps extends AntdMenuProps {
  router: RouteType[];
  collapsed?: boolean;
  menuItems?: MenuType[];
  onlyLvOneMenu?: boolean;
  getCurrChildItems?: (children: MenuType[]) => void;
  /** 次级菜单顶部的自定义区域（返回入口、标题、检索框之类），只在次级菜单生效 */
  secondaryHeader?: ReactNode;
  /**
   * 次级菜单项的额外过滤，按菜单项的 key（绝对路径）判断。
   * 留给依赖运行时业务数据、菜单表达不了的规则。
   */
  secondaryItemFilter?: (key: string) => boolean;
}

/**
 * 次级菜单根：进入它的子树后，整个侧栏换成那些子页。
 * 由菜单表的 `cat=1` 显式标记，不靠前端推断。
 */
const isSecondaryRoot = (route: RouteType): boolean =>
  !!route.path && !!route.children?.length && route.meta?.secondary === true;

/** 把菜单项 key 里的路由参数按当前地址回填：/order/:id/detail → /order/1024/detail */
const fillParams = (key: string, params: Record<string, string | undefined>) =>
  key.replace(/:([^/]+)/g, (seg, name: string) => params[name] ?? seg);

const Menu: React.FC<MenuProps> = (props) => {
  const {
    router,
    collapsed = false,
    className,
    theme = "dark",
    mode = "inline",
    getCurrChildItems,
    menuItems,
    onlyLvOneMenu = false,
    secondaryHeader,
    secondaryItemFilter,
    ...menuConfig
  } = props;
  const navigate = useNavigate();
  const location = useLocation();

  // 当前地址落在某个次级菜单根之下时，侧栏整个换成那棵子树
  const secondary = useMemo(() => {
    const find = (routes?: RouteType[]): RouteType | undefined => {
      for (const r of routes ?? []) {
        if (
          isSecondaryRoot(r) &&
          matchPath({ path: r.path as string, end: false }, location.pathname)
        ) {
          return r;
        }
        const hit = find(r.children);
        if (hit) return hit;
      }
      return undefined;
    };
    return find(router);
  }, [router, location.pathname]);

  const items = useMemo(() => {
    if (secondary?.path) {
      const rootLen = secondary.path.length;
      // all=true：这些子页本就都不进主侧栏，按 menu 标记会被全部过滤掉
      return formatMenu(secondary.children ?? [], true)
        // 自身那段还带参数的（detail/:id）点不进去，不列
        .filter((i) => !i.key.slice(rootLen).includes(":"))
        .filter((i) => secondaryItemFilter?.(i.key) ?? true);
    }
    return menuItems ? cloneDeep(menuItems) : formatMenu(router);
  }, [router, menuItems, secondary, secondaryItemFilter]);

  const allItems = useMemo(() => {
    return menuItems
      ? cloneDeep(menuItems)
      : formatMenu(cloneDeep(router), true);
  }, [router, menuItems]);

  const { menuKey, setMenuKey, openKeys, setOpenkeys } = useMenuPath({
    allItems,
    collapsed,
    mode,
  });

  const _items: MenuType[] = useMemo(() => {
    const _items: MenuType[] = cloneDeep(items);
    setActiveIcon(_items, menuKey);
    return _items;
  }, [items, menuKey]);

  useOnlyLvOneMenu({
    items,
    onlyLvOneMenu,
    getCurrChildItems,
    setOpenkeys,
    setMenuKey,
  });

  // Cloudflare style: the sidebar (inline) renders top-level directories as non-collapsible "groups";
  // level 1 = gray section title, level 2 = flat items; collapsible submenus are no longer used in expanded mode.
  const cfGroupItems = useMemo<ItemType[]>(() => {
    return _items.map((it) =>
      it.children?.length && !collapsed
        ? ({
            type: "group",
            key: it.key,
            label: it.title ?? it.label,
            children: it.children,
          } as ItemType)
        : (it as ItemType)
    );
  }, [_items, collapsed]);

  const menu = (
    <AntdMenu
      {...menuConfig}
      mode={mode}
      inlineCollapsed={collapsed}
      items={
        onlyLvOneMenu
          ? (_items?.map((i) => ({ ...i, children: undefined })) as ItemType[])
          : mode === "inline"
            ? cfGroupItems
            : _items
      }
      onClick={(v) => {
        if (onlyLvOneMenu) {
          getCurrChildItems?.(
            items.find((i) => i.key === v.key)?.children || []
          );
          setOpenkeys([v.key]);
          setMenuKey(v.key);
        } else {
          // 次级菜单的 key 是带参模式（/admin/order/:id/detail），按当前地址回填再跳
          const params = secondary?.path
            ? (matchPath({ path: secondary.path, end: false }, location.pathname)
                ?.params ?? {})
            : {};
          navigate(fillParams(v.key, params));
        }
      }}
      selectedKeys={[menuKey]}
      openKeys={openKeys}
      onOpenChange={(keys: string[]) => {
        setOpenkeys(keys);
      }}
      theme={theme}
      className={classNames(styles.menu, className)}
    />
  );

  // 次级菜单默认带一段头部（至少给出返回入口），调用方可用 secondaryHeader 整块换掉
  return secondary ? (
    <div className={styles.secondaryWrap}>
      {secondaryHeader ?? (
        <SecondaryHeader collapsed={collapsed} theme={theme as "light" | "dark"} />
      )}
      {menu}
    </div>
  ) : (
    menu
  );
};

export default Menu;
