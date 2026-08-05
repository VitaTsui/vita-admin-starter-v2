import { MenuList, getMenuList, getPermissions } from "@/services/apis/permit";
import { makeAutoObservable } from "mobx";
import { cloneDeep } from "lodash";
import wsCache, { CACHE_KEY } from "@/utils/wsCache";

import { Icon } from "@hsu-react/ui";
// Panel 不能在这里静态导入：它会顺着 Panel → Search → FormItem 把全部字段渲染器
// 和 Chart → echarts 拖进首屏。详见 IframePanel 里的说明
import IframePanel from "./_components/IframePanel";
import NoFoundPage from "@/404";
import { Outlet } from "react-router";
import { ADMIN_BASE, RouteType } from "./router.config";
import Router from "./router.config";
import RouterContainer from "./_components/RouterContainer";
import { getAccessToken } from "@/utils/auth";
import { lazy } from "react";
import { array_is_includes } from "hsu-utils";

// Menu path mapping: old path -> new path
const MENU_PATH_MAPPING: Readonly<Record<string, string>> = {
  "sys/dept/index": "permit/dept/index",
  "sys/menu/index": "permit/menu/index",
  "sys/role/index": "permit/role/index",
  "sys/user/index": "permit/user/index",
  "sys/log/log": "syslog/ApiLog/index",
  "sys/logError/logError": "syslog/ErrorLog/index",
  "sys/logLogin/logLogin": "syslog/LoginLog/index",
  "sys/oprLog/oprLog": "syslog/OprLog/index",
  "sys/logChange/logChange": "syslog/LogChange/index",
  "sys/dict/index": "sysmgmt/Dict/index",
  "sys/param/param": "sysmgmt/Param/index",
  "sys/fileConf/index": "systool/File/index",
};

// Path prefix mapping: old prefix -> new prefix
const PATH_PREFIX_MAPPING: Readonly<Record<string, string>> = {
  "/sys": "/platform",
  "/log": "/syslog",
};

/**
 * Recursively wrap routes, adding the RouterContainer wrapper component to each route
 */
function wrapRoutes(routes: RouteType[]): RouteType[] {
  return routes?.map((route) => {
    const newRoute = { ...route };

    newRoute.element = <RouterContainer {...route} />;

    if (route.children?.length) {
      newRoute.children = wrapRoutes(route.children);
    }

    return newRoute;
  });
}

/**
 * Dynamically import all page components with webpack's require.context
 * This is a webpack-specific feature for importing modules in bulk
 */
/**
 * Dynamically import page components with webpack's require.context.
 *
 * 第四个参数 "lazy" 是关键：默认的 "sync" 模式会把所有匹配到的模块拉进入口图，
 * 外面套的 lazy() 完全没有分割收益——整个 pages 目录、连同它从 @hsu-react/ui
 * 传递引入的富文本/表格/图表/PDF 都会进首屏。"lazy" 模式下 r(key) 返回 Promise，
 * 每个页面各自成 chunk，正是 RouterContainer 里 <Suspense> 已经准备好接的形态。
 *
 * 正则只匹配页面入口（`<...>/index.tsx`）；下面的 filter 再排除页面私有目录与
 * 表单弹窗——它们不可能是菜单目标，且已能通过父页面的静态引用到达，匹配进来
 * 只会白白多出一堆 chunk。
 */
const pages = require.context("../pages/", true, /\/index\.tsx$/, "lazy");

/** 不可能作为菜单目标的路径段：页面私有目录与表单弹窗 */
const isPrivateModulePath = (key: string) =>
  key.split(/[\\/]/).some((seg) => seg.startsWith("_") || /Form$/.test(seg));

/**
 * Convert all page components into a lazy-loaded component map
 * @param r - webpack require.context object
 * @returns Map from component paths to lazy-loaded components
 */
function importAll(r: __WebpackModuleApi.RequireContext) {
  const modules: Record<
    string,
    React.LazyExoticComponent<React.ComponentType>
  > = {};

  r.keys()
    .filter((key) => !isPrivateModulePath(key))
    .forEach((key) => {
      const normalizedKey = key
        .toLowerCase()
        .replace(/\.tsx$/, "")
        .replace(/^\.\//, "");

      // "lazy" 模式下 r(key) 本身就是模块命名空间的 Promise，正是 lazy() 想要的形状
      modules[normalizedKey] = lazy(
        () => r(key) as Promise<{ default: React.ComponentType }>
      );
    });

  return modules;
}

const modules = importAll(pages);

class RouterStore {
  get router() {
    return this._router;
  }
  private _router: RouteType[] = Router;

  get permissions() {
    return this._permissions;
  }
  private _permissions: string[] | null = null;

  private _menuList: MenuList[] = [];

  // Debounced functions must be persisted to avoid creating new instances on every autorun
  constructor() {
    makeAutoObservable(this);

    // 冷启动（带着已有 token 刷新页面）时把菜单与权限拉起来。
    // 这里从前是 autorun ＋ 两个 debounce：autorun 里只读了 getAccessToken()，
    // 而 token 存在 localStorage、不是 observable，所以它只会执行一次，
    // 那两个 debounce 从来没有第二次调用可去重——直接调用即可，语义还更清楚。
    // 登录成功后的刷新由 LoginStore 显式调 getMenuList(true) / getPermissions(true)。
    if (getAccessToken()) {
      this.getMenuList();
      this.getPermissions();
    }
  }

  public getPermissions = async (reload: boolean = false) => {
    if (wsCache.get(CACHE_KEY.ROLE_PERMISSION) && !reload) {
      this._permissions = wsCache.get(CACHE_KEY.ROLE_PERMISSION);
    } else {
      const res = await getPermissions();
      if (res.code === 0) {
        this._permissions = res.data.stringPermissions;
        wsCache.set(CACHE_KEY.ROLE_PERMISSION, this._permissions);
      }
    }
  };

  public getMenuList = async (reload: boolean = false) => {
    const router = cloneDeep(Router);

    // 与 getPermissions 同一套策略：先用缓存立即渲染，再拉最新覆盖。
    // 从前是「有缓存就只读缓存、完全不请求」，部署新增菜单后旧缓存会一直挡着
    // 新菜单，直到用户重新登录一次——两个方法行为不一致本身也是坑。
    if (wsCache.get(CACHE_KEY.ROLE_ROUTERS) && !reload) {
      this._menuList = wsCache.get(CACHE_KEY.ROLE_ROUTERS);
    }
    const res = await getMenuList();
    if (res.code === 0) {
      this._menuList = res.data.menuList;
      wsCache.set(CACHE_KEY.ROLE_ROUTERS, this._menuList);
    }

    const _router = this._formatMenuLIst(this._menuList);
    const children = router[0].children
      ? router[0].children.concat(_router)
      : _router;
    router[0].children = wrapRoutes(children);

    router.push({
      path: "*",
      element: <NoFoundPage />,
    });

    this._router = router;
  };

  /**
   * Normalize a path: handle index paths, add the leading slash, apply path mappings, etc.
   */
  private _normalizePath = (
    path: string,
    parentPath?: string,
    applyMapping: boolean = true
  ): string => {
    let normalizedPath = path;

    // Handle index paths
    if (normalizedPath === "index" && parentPath) {
      normalizedPath = parentPath;
    }

    // Ensure the path starts with /
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }

    // Admin pages are all mounted under the /admin prefix (the AI Q&A page owns the root path).
    // Both parent and child levels get the prefix here, keeping _normalizePath's parent-child merge logic unaffected.
    if (
      normalizedPath !== ADMIN_BASE &&
      !normalizedPath.startsWith(`${ADMIN_BASE}/`)
    ) {
      normalizedPath = `${ADMIN_BASE}${normalizedPath}`;
    }

    // Apply the path prefix mapping (only for root-level routes)
    if (applyMapping && !parentPath) {
      for (const [oldPrefix, newPrefix] of Object.entries(
        PATH_PREFIX_MAPPING
      )) {
        if (normalizedPath.startsWith(oldPrefix)) {
          normalizedPath = normalizedPath.replace(oldPrefix, newPrefix);
          break;
        }
      }
    }

    // Merge the parent path
    if (parentPath) {
      const parentParts = parentPath.split("/");
      const currentParts = normalizedPath.split("/");

      if (!array_is_includes(parentParts, currentParts)) {
        normalizedPath = `${parentPath}${normalizedPath}`;
      }
    }

    return normalizedPath;
  };

  /**
   * Normalize a component URL
   */
  private _normalizeComponentUrl = (url: string): string => {
    const cleanUrl = url.startsWith("/")
      ? url.split("/").filter(Boolean).join("/")
      : url;
    return MENU_PATH_MAPPING[cleanUrl] || cleanUrl;
  };

  /**
   * Set the route's element property based on the URL
   */
  private _setRouteElement = (_router: RouteType, url: string): void => {
    const normalizedUrl = this._normalizeComponentUrl(url);
    const lowerCaseUrl = normalizedUrl.toLowerCase();

    // Check whether a matching module exists
    if (modules?.[lowerCaseUrl]) {
      const Element = modules[lowerCaseUrl];

      if (_router.children) {
        _router.element = <Outlet />;
        _router.meta = {
          ..._router.meta,
          noLazy: true,
          noCache: true,
        };
        _router.children.unshift({
          index: true,
          element: <Element />,
          // Inherit the parent's name/icon; otherwise this default index page would create a tab with an empty label
          meta: { name: _router.meta?.name, icon: _router.meta?.icon },
        });
      } else {
        _router.element = <Element />;
      }
      return;
    }

    // Check whether it is an external URL or an internal route
    const urlType = this._detectHttpUrlType(normalizedUrl);

    if (urlType === "invalid" || urlType === "localhost") {
      return;
    }

    if (urlType === "route") {
      const router = Router.find((route) => route.path === `/${normalizedUrl}`);
      if (router) {
        _router.element = <IframePanel>{router.element}</IframePanel>;
        _router.meta = {
          ..._router.meta,
          noLazy: true,
        };
      }
    } else {
      _router.element = <IframePanel src={normalizedUrl} />;
      _router.meta = {
        ..._router.meta,
        noLazy: true,
        noCache: true,
      };
    }
  };

  private _formatMenuLIst = (menuList: MenuList[], parentPath?: string) => {
    const router: RouteType[] = [];

    menuList?.forEach((item) => {
      let children: RouteType[] = [];

      // Use the unified path normalization function
      const path = this._normalizePath(item.path, parentPath);

      const _router: RouteType = {
        path,
        meta: {
          name: item.nm,
          title: item.nm,
          menu: !item.status,
          icon: item.icon ? <Icon icon={item.icon} /> : undefined,
          hasPermi: item.perm ? [item.perm] : undefined,
        },
      };

      if (parentPath === path) {
        delete _router.path;

        (_router as { index: boolean }).index = true;
      }

      if (!_router.index && item.children) {
        children = this._formatMenuLIst(item.children, _router.path);
        _router.children = children.length > 0 ? children : undefined;
      }

      // Handle the component URL
      if (item.url) {
        this._setRouteElement(_router, item.url);
      } else if (_router.children) {
        // No URL but has child routes; set to Outlet
        _router.element = <Outlet />;
        _router.meta = {
          ..._router.meta,
          noLazy: true,
          noCache: true,
        };
      }

      if (_router.element) router.push(_router);
    });

    return router;
  };

  /**
   * Check whether a path exists in the route config
   * @param path - Route path, e.g. "/home" or "/platform/user/index"
   * @param exactMatch - Whether to match exactly, default true. When false, matches path prefixes
   * @returns Whether the path exists
   * @example
   * RouterService.hasPath("/home") // true
   * RouterService.hasPath("/nonexistent") // false
   * RouterService.hasPath("/platform", false) // true (matches /platform/xxx)
   */
  public hasPath = (path: string, exactMatch: boolean = true): boolean => {
    if (!path || typeof path !== "string") {
      return false;
    }

    const normalizedPath = path.trim();

    const searchInRoutes = (routes: RouteType[]): boolean => {
      for (const route of routes) {
        // Skip routes without a path (e.g. index routes)
        if (!route.path) {
          if (route.children?.length) {
            if (searchInRoutes(route.children)) return true;
          }
          continue;
        }

        // Exact match or prefix match
        if (exactMatch) {
          if (route.path === normalizedPath) return true;
        } else {
          if (normalizedPath.startsWith(route.path)) return true;
        }

        // Recursively search child routes
        if (route.children?.length) {
          if (searchInRoutes(route.children)) return true;
        }
      }
      return false;
    };

    return searchInRoutes(this._router);
  };

  /**
   * Find the route matching a component URL path
   * @param componentUrl - Component file path, e.g. "permit/user/index" or "sys/user/index"
   * @returns The matching route object or undefined
   */
  public findRouteByComponentUrl = (
    componentUrl: string
  ): RouteType | undefined => {
    if (!componentUrl || typeof componentUrl !== "string") {
      return undefined;
    }

    // Normalize the component URL: strip leading slashes, convert to lowercase
    const normalizedUrl = componentUrl.trim().toLowerCase().replace(/^\/+/, "");

    // Apply the menu path mapping
    const mappedUrl = MENU_PATH_MAPPING[normalizedUrl] || normalizedUrl;

    const findInRoutes = (routes: RouteType[]): RouteType | undefined => {
      for (const route of routes) {
        // Get the route's component URL and match against it
        const routeComponentUrl = this._getRouteComponentUrl(route);

        if (
          routeComponentUrl &&
          (routeComponentUrl === mappedUrl ||
            routeComponentUrl === normalizedUrl)
        ) {
          return route;
        }

        // Recursively search child routes
        if (route.children?.length) {
          const found = findInRoutes(route.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    return findInRoutes(this._router);
  };

  /**
   * Extract the component URL path from a route object
   * @param route - Route object
   * @returns The component URL or undefined
   */
  private _getRouteComponentUrl = (route: RouteType): string | undefined => {
    const findUrlInMenuList = (
      menuList: MenuList[],
      targetPath?: string,
      parentPath?: string
    ): string | undefined => {
      for (const item of menuList) {
        // Use the unified path normalization function
        const path = this._normalizePath(item.path, parentPath);

        // Match against the target path
        if (path === targetPath && item.url) {
          return item.url.split("/").filter(Boolean).join("/").toLowerCase();
        }

        // Recursively search child routes
        if (item.children) {
          const found = findUrlInMenuList(item.children, targetPath, path);
          if (found) return found;
        }
      }
      return undefined;
    };

    return findUrlInMenuList(this._menuList, route.path);
  };

  /**
   * Detect the URL type
   * @param url - URL string to check
   * @returns URL type:
   *  - "localhost": http(s)://localhost or http(s)://127.0.0.1
   *  - "ip": http(s)://IP address
   *  - "domain": http(s)://domain name
   *  - "ip-port": IP:port format (without protocol)
   *  - "ip-only": IP address (without port or protocol)
   *  - "route": fixed internal route path
   *  - "invalid": invalid URL
   */
  private _detectHttpUrlType = (
    url: string
  ):
    | "localhost"
    | "ip"
    | "domain"
    | "ip-port"
    | "ip-only"
    | "route"
    | "invalid" => {
    if (!url || typeof url !== "string") {
      return "invalid";
    }

    const trimmedUrl = url.trim();

    // URL matching rule config
    const URL_PATTERNS = {
      localhost: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i,
      ip: /^https?:\/\/((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(:\d+)?(\/.*)?$/,
      domain:
        /^https?:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/,
      ipPort:
        /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d):\d+$/,
      ipOnly:
        /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
    };

    // Detect the URL type by priority
    if (URL_PATTERNS.localhost.test(trimmedUrl)) {
      return "localhost";
    }

    if (URL_PATTERNS.ip.test(trimmedUrl)) {
      return "ip";
    }

    if (URL_PATTERNS.domain.test(trimmedUrl)) {
      return "domain";
    }

    if (URL_PATTERNS.ipPort.test(trimmedUrl)) {
      return "ip-port";
    }

    if (URL_PATTERNS.ipOnly.test(trimmedUrl)) {
      return "ip-only";
    }

    // Check whether it is a fixed internal route
    if (Router.some((route) => route.path === `/${trimmedUrl}`)) {
      return "route";
    }

    return "invalid";
  };
}

const RouterService = new RouterStore();
export default RouterService;
