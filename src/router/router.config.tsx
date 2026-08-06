import App from "@/App";
import { ReactNode, lazy } from "react";
import { Navigate, RouteObject } from "react-router-dom";

// 登录页必须懒加载。它和 App 里的改密弹窗是入口图里仅有的两个 hsu-ui `FormItem`
// 消费者，而 FormItem 静态引入了全部字段渲染器（wangeditor / codemirror / pdfjs /
// xlsx）。代价只是未登录用户多一次 chunk 往返，而已登录用户根本不渲染登录页。
const Login = lazy(() => import("@/pages/Login"));

// Detail/sub-pages (with route params, not in the backend menu) are explicitly registered here as admin child routes.
// Example: const FooDetail = lazy(() => import("@/pages/foo/Detail"));

/**
 * MetaType route meta info
 *
 * title: suffix title for the browser tab
 * name: menu name
 * menu: whether to show in the menu; dynamic routes are never shown in the menu
 * icon: menu icon
 * activeIcon: active menu icon
 * disabled: whether disabled
 * affix: whether pinned in the tab bar
 * noTagsView: whether hidden from the tab bar; if true, not shown in the tab bar but still shown in the menu
 * noCache: whether to skip caching, default true; always no caching when there are children
 * noLazy: whether not lazy-loaded, default false
 * noAuth: whether to skip permission checks, default false
 * hasPermi: whether restricted by permissions
 * secondary: 次级菜单根——进入它的子树后整个侧栏换成那些子页（来自菜单表的 cat=1）
 */
export type MetaType = {
  title?: string;
  name?: string;
  menu?: boolean;
  icon?: ReactNode;
  activeIcon?: ReactNode;
  disabled?: boolean;
  affix?: boolean;
  noTabsView?: boolean;
  noCache?: boolean;
  noLazy?: boolean;
  noAuth?: boolean;
  hasPermi?: string[];
  secondary?: boolean;
};

export type RouteType = {
  children?: RouteType[];
  meta?: MetaType;
} & RouteObject;

// Unified route prefix for the admin (back-office management) area
export const ADMIN_BASE = "/admin";
// Default admin landing page (fallback after logging into the admin area or closing all tabs)
export const ADMIN_HOME = `${ADMIN_BASE}/overview`;

/**
 * Build the absolute path of an admin page, ensuring all navigation follows ADMIN_BASE changes.
 * Any hard-coded navigation to admin pages should use this function instead of hand-written "/admin/xxx".
 * @example adminPath("permit/user/index")   // "/admin/permit/user/index"
 * @example adminPath(`syslog/detail/${id}`) // "/admin/syslog/detail/1"
 * @example adminPath()                      // "/admin"
 */
export const adminPath = (sub = ""): string => {
  const clean = sub.replace(/^\/+/, "");
  return clean ? `${ADMIN_BASE}/${clean}` : ADMIN_BASE;
};

const Router: RouteType[] = [
  {
    // Admin layout: dynamic menus (from the backend) are mounted as children of this route, all paths prefixed with /admin
    path: ADMIN_BASE,
    element: <App />,
    meta: {
      noTabsView: true,
    },
    children: [
      {
        index: true,
        element: <Navigate to={ADMIN_HOME} replace />,
        // Only used for post-login/fallback redirects; must not become a tab (otherwise a bare /admin would leave a blank tab)
        meta: { noTabsView: true },
      },
      // Explicitly register detail/sub-pages with route params that are not in the backend menu here, e.g.:
      // {
      //   path: adminPath("foo/detail/:id"),
      //   element: <FooDetail />,
      //   meta: { name: "详情", title: "详情", noCache: true },
      // },
    ] as RouteType[],
  },
  {
    path: "/login",
    element: <Login />,
    meta: {
      title: "登录",
      noAuth: true,
    },
  },
  {
    // Root path defaults to the admin area; the /admin index redirects to the landing page
    path: "/",
    element: <Navigate to={ADMIN_BASE} replace />,
    meta: {
      noAuth: true,
      noTabsView: true,
    },
  },
];

export default Router;
