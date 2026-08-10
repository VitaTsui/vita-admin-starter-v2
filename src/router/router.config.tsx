import App from "@/App";
import { lazy } from "react";
import { Navigate } from "react-router-dom";

// 登录页必须懒加载。它和 App 里的改密弹窗是入口图里仅有的两个 hsu-ui `FormItem`
// 消费者，而 FormItem 静态引入了全部字段渲染器（wangeditor / codemirror / pdfjs /
// xlsx）。代价只是未登录用户多一次 chunk 往返，而已登录用户根本不渲染登录页。
const Login = lazy(() => import("@/pages/Login"));

// Detail/sub-pages (with route params, not in the backend menu) are explicitly registered here as admin child routes.
// Example: const FooDetail = lazy(() => import("@/pages/foo/Detail"));

/**
 * 路由的附加信息与路由表类型。
 *
 * 这两个类型的**唯一定义**在 `@hsu-react/ui/es/layout` —— 菜单、面包屑、页签都按它取展示
 * 信息，本项目此前自己维护一份逐字相同的副本，字段一旦不同步就是「配了不生效」这种
 * 无声故障。这里只做转出，让项目里原有的 `@/router/router.config` 引用照常可用。
 *
 * 哪些字段由布局组件读、哪些只是搭车给应用自己用，见组件库文档的 Header 一节。
 */
export type { MetaType, RouteType } from "@hsu-react/ui/es/layout";
import type { RouteType } from "@hsu-react/ui/es/layout";

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
