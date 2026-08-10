import {
  FetchEventSourceInit,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import axios, {
  AxiosHeaders,
  AxiosResponse,
  AxiosResponseHeaders,
  ResponseType,
} from "axios";

import { Typeof, getFileNameFromHeader } from "hsu-utils";
import { debounce } from "lodash";
import { getAccessToken } from "@/utils/auth";
import { notification } from "@hsu-react/ui";
import wsCache from "@/utils/wsCache";

/**
 * Get the CSRF Token
 * Prefer reading it from cookies; fall back to the meta tag if not found
 * @returns CSRF Token string
 */
function getCsrfToken(): string {
  // Method 1: read the CSRF token from cookies (common names)
  const csrfCookieNames = ["XSRF-TOKEN", "X-CSRF-TOKEN", "CSRF-TOKEN", "_csrf"];
  for (const name of csrfCookieNames) {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split("=");
      if (key === name && value) {
        return decodeURIComponent(value);
      }
    }
  }

  // Method 2: read from the meta tag
  const metaToken = document.querySelector<HTMLMetaElement>(
    'meta[name="csrf-token"]'
  );
  if (metaToken?.content) {
    return metaToken.content;
  }

  // Method 3: read from the data attribute
  const dataToken = document.querySelector<HTMLElement>("[data-csrf-token]");
  if (dataToken?.dataset?.csrfToken) {
    return dataToken.dataset.csrfToken;
  }

  return "";
}

/**
 * Check whether a request is same-origin
 * @param url request URL
 * @returns whether the request is same-origin
 */
function isSameOrigin(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.origin === window.location.origin;
  } catch {
    // Treat relative paths as same-origin
    return url.startsWith("/") || !url.includes("://");
  }
}

const codeMessage: Record<number, string> = {
  200: "服务器成功返回请求的数据。",
  201: "新建或修改数据成功。",
  202: "一个请求已经进入后台排队（异步任务）。",
  204: "删除数据成功。",
  400: "发出的请求有错误，服务器没有进行新建或修改数据的操作。",
  401: "用户没有权限（令牌、用户名、密码错误）。",
  403: "用户得到授权，但是访问是被禁止的。",
  404: "发出的请求针对的是不存在的记录，服务器没有进行操作。",
  406: "请求的格式不可得。",
  410: "请求的资源被永久删除，且不会再得到的。",
  422: "当创建一个对象时，发生一个验证错误。",
  500: "服务器发生错误，请检查服务器。",
  502: "网关错误。",
  503: "服务不可用，服务器暂时过载或维护。",
  504: "网关超时。",
};

// Clear all cookies
export function clearAllCookie() {
  const keys = document.cookie.match(/[^ =;]+(?==)/g);

  keys?.forEach((key: string) => {
    document.cookie = key + "=0;expires=" + new Date(0).toUTCString();
  });
}

/**
 * Safe redirect function to prevent Open Redirect vulnerabilities
 * @param path redirect path, must be a relative path (starting with /)
 */
function safeRedirect(path: string): void {
  // Validate that the path is a relative path (starting with /)
  if (!path || typeof path !== "string" || !path.startsWith("/")) {
    path = "/login"; // Redirect to the login page by default
  }

  // Strip any query params and hash to prevent injection
  const cleanPath = path.split("?")[0].split("#")[0];

  // Ensure the path contains no protocol/domain, allow relative paths only
  if (cleanPath.includes("://") || cleanPath.includes("//")) {
    // Build the full URL with the current origin so we only redirect within the current domain
    const currentOrigin = window.location.origin;
    window.location.href = `${currentOrigin}/login`;
    return;
  }

  // Build the full URL with the current origin so we only redirect within the current domain
  const currentOrigin = window.location.origin;
  window.location.href = `${currentOrigin}${cleanPath}`;
}

// Re-login
const reLogin = debounce(() => {
  notification.error({
    title: "登录已过期，请重新登录",
    duration: 0.5,
    onClose: () => {
      safeRedirect("/login");
      wsCache.clear();
      clearAllCookie();
    },
  });
});

const errMsg = debounce((status: number, url: string, errorText: string) => {
  notification.error({
    title: `请求错误 ${status}：${window.decodeURIComponent(url)}`,
    description: errorText,
  });
});

/**
 * fetch response interceptor
 */
const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  const [resource, config = {}] = args;
  const requestUrl =
    typeof resource === "string"
      ? resource
      : resource instanceof Request
      ? resource.url
      : resource.toString();

  // CSRF protection: add a CSRF token and custom header to same-origin requests
  if (requestUrl && isSameOrigin(requestUrl)) {
    const csrfToken = getCsrfToken();
    const headers = new Headers(config.headers);

    if (csrfToken) {
      headers.set("X-CSRF-TOKEN", csrfToken);
      headers.set("X-XSRF-TOKEN", csrfToken);
    }

    // Add a custom header to mark the request as AJAX
    headers.set("X-Requested-With", "XMLHttpRequest");

    config.headers = headers;
  }

  const response = await originalFetch(resource, {
    ...config,
  });

  const { status, url, statusText, ok } = response;

  if (!ok) {
    if (status === 401) {
      reLogin();
    } else {
      const errorText = codeMessage[status] || statusText;

      errMsg(status, url, errorText);

      return Promise.reject(resource);
    }
  }

  try {
    const { value } = (await response.clone().body?.getReader()?.read()) ?? {};
    const decoder = new TextDecoder();
    if (value) {
      const text = decoder.decode(value);
      const { header } = JSON.parse(text ?? JSON.stringify({}));
      if (header?.code === 401) {
        reLogin();
      }
    }
  } catch {
    return Promise.resolve(response);
  }

  return Promise.resolve(response);
};

/**
 * axios request interceptor
 */
axios.interceptors.request.use((config) => {
  const { url } = config;
  const dev = process.env.NODE_ENV === "development";
  const apiBase = process.env.API_BASE;
  if (dev && apiBase && url && !url.startsWith(apiBase)) {
    config.url = `${apiBase}${config.url}`;
  }

  // CSRF protection: add a CSRF token and custom header
  if (url && isSameOrigin(url)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      // Add the CSRF token to request headers (common header names)
      config.headers = config.headers || {};
      config.headers["X-CSRF-TOKEN"] = csrfToken;
      config.headers["X-XSRF-TOKEN"] = csrfToken;
    }

    // Add a custom header to mark the request as AJAX, preventing CSRF attacks
    config.headers = config.headers || {};
    config.headers["X-Requested-With"] = "XMLHttpRequest";
  }

  return config;
});

/**
 * axios response interceptor
 */
axios.interceptors.response.use(
  (res) => {
    const data = res.data;
    const { header } = data;

    if (header?.code === 401 && !skipAuthRedirect(res.config)) {
      reLogin();
    }

    return res;
  },
  (err) => {
    if (!err?.response) return Promise.reject(err);

    const { status, config, statusText } = err.response;

    if (status === 401) {
      // Requests marked as silent (e.g. login-page probe for the DingTalk toggle) do not redirect to login on 401; the error is only rethrown
      if (!skipAuthRedirect(err.config)) {
        reLogin();
      }
      return Promise.reject(err);
    } else {
      const errorText = codeMessage[status] || statusText;

      errMsg(status, config.url, errorText);

      return Promise.reject(err);
    }
  }
);

/** Read the "skip 401 redirect" flag from the request config */
function skipAuthRedirect(config?: unknown): boolean {
  return !!(config as { skipAuthRedirect?: boolean } | undefined)
    ?.skipAuthRedirect;
}

/**
 * axios response data preprocessing
 */
export interface ResType<T = unknown> {
  header?: Record<string, string>;
  data: T;
  code: number;
  msg?: string;
}
const response = async <T>(res: AxiosResponse<ResType<T>>): Promise<ResType<T>> => {
  let data = res.data;

  if (Typeof(data) === "blob" || Typeof(data) === "arraybuffer") {
    // With a forced responseType, a 200 + JSON business error also arrives as a blob:
    // detect by content-type and unwrap the envelope so it goes through normal error
    // handling instead of being treated as a successfully downloaded file
    const ct = String(
      (res.headers as Record<string, unknown>)?.["content-type"] ?? ""
    );
    if (ct.includes("application/json")) {
      try {
        const text =
          Typeof(data) === "blob"
            ? await (data as unknown as Blob).text()
            : new TextDecoder().decode(data as unknown as ArrayBuffer);
        data = JSON.parse(text);
      } catch {
        // Parsing failed: keep treating it as a file
      }
    }
  }

  if (Typeof(data) === "blob" || Typeof(data) === "arraybuffer") {
    const filename = getFileNameFromHeader(
      res as { headers: AxiosResponseHeaders }
    );

    return {
      data: {
        filename,
        data: data,
      } as unknown as T,
      code: 0,
    };
  }

  if (data.code === undefined) {
    return {
      data: data as unknown as T,
      code: 0,
    };
  }

  if (data.code === 401 && !skipAuthRedirect(res.config)) {
    reLogin();
  }

  return data;
};

// Read the token (the backend validates the bare token directly, no Bearer prefix needed)
const getToken = () => {
  const token = getAccessToken();
  return token ?? "";
};

/**
 * default config
 */
axios.defaults.withCredentials = true;
axios.defaults.headers["tenant-id"] = "0";

interface Params {
  query?: string;
}

/**
 * 把 params 里的 query 提到 URL 上（Query 类已经 encodeURIComponent 过，直接拼）。
 *
 * 返回**新的** params，不改调用方传进来的那个对象。从前这里是 `delete params.query`
 * 就地删——目前所有调用点都传新建的对象字面量所以没爆，但只要有人改成传 store 里
 * 持有的稳定对象，query 就会被永久删掉，第二次请求静默变成无条件全量查询。
 */
const liftQuery = <P>(url: string, params?: Params | P) => {
  const { query, ...rest } = (params ?? {}) as Params;

  return {
    url: query ? `${url}?query=${query}` : url,
    params: rest as P,
  };
};

/**
 * GET
 * @param url
 * @param config
 * @returns
 */
export const get = async <T, P = object>(
  url: string,
  config?: {
    params?: Params | P;
    responseType?: ResponseType;
    headers?: AxiosHeaders;
    /** When true, a 401 on this request does not trigger the global login redirect (for probe requests in a logged-out state) */
    skipAuthRedirect?: boolean;
  }
): Promise<ResType<T>> => {
  if (!url) return Promise.reject("url is required");

  const { url: _url, params } = liftQuery<P>(url, config?.params);

  const res = await axios.get(_url, {
    ...config,
    params,
    headers: {
      Authorization: getToken(),
      ...config?.headers,
    },
  });
  return response<T>(res);
};

/**
 * POST
 * @param url
 * @param config
 * @returns
 */
export const post = async <T = undefined, D = object, P = object>(
  url: string,
  data?: D,
  config?: {
    params?: Params | P;
    responseType?: ResponseType;
    headers?: AxiosHeaders;
  }
): Promise<ResType<T>> => {
  if (!url) return Promise.reject("url is required");

  const { url: _url, params } = liftQuery<P>(url, config?.params);

  const res = await axios.post(_url, data, {
    ...config,
    params,
    headers: {
      Authorization: getToken(),
      ...config?.headers,
    },
  });
  return response<T>(res);
};

/**
 * DELETE
 * @param url
 * @param config
 * @returns
 */
export const del = async <T = undefined, P = object>(
  url: string,
  config?: {
    params?: Params | P;
    headers?: AxiosHeaders;
  }
): Promise<ResType<T>> => {
  if (!url) return Promise.reject("url is required");

  const { url: _url, params } = liftQuery<P>(url, config?.params);

  const res = await axios.delete(_url, {
    ...config,
    params,
    headers: {
      Authorization: getToken(),
      ...config?.headers,
    },
  });
  return response<T>(res);
};

/**
 * PUT
 * @param url
 * @param config
 * @returns
 */
export const put = async <T = undefined>(
  url: string,
  data?: object,
  config?: {
    headers?: AxiosHeaders;
  }
): Promise<ResType<T>> => {
  if (!url) return Promise.reject("url is required");

  const res = await axios.put(url, data, {
    headers: {
      Authorization: getToken(),
      ...config?.headers,
    },
  });
  return response<T>(res);
};

/**
 * Streaming request
 */
interface streamRequestOptions<T = Record<string, unknown>>
  extends FetchEventSourceInit {
  data: T;
}
export function streamRequest<T>(
  url: string,
  options: streamRequestOptions<T>
) {
  const { onopen, onmessage, onclose, onerror, data } = options;
  const _options = { ...options, body: JSON.stringify(data) };
  const token = getToken();

  _options.headers = {
    ..._options.headers,
    "Content-Type": "application/json",
    Authorization: token,
  };

  // CSRF protection: add a CSRF token and custom header to same-origin requests
  if (isSameOrigin(url)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      _options.headers = {
        ..._options.headers,
        "X-CSRF-TOKEN": csrfToken,
        "X-XSRF-TOKEN": csrfToken,
      };
    }

    _options.headers = {
      ..._options.headers,
      "X-Requested-With": "XMLHttpRequest",
    };
  }


  const controller = new AbortController();
  fetchEventSource(url, {
    ..._options,
    method: "POST",
    signal: controller.signal,
    onopen,
    onmessage,
    onclose() {
      controller.abort();
      onclose && onclose();
    },
    onerror(err) {
      controller.abort();
      onerror && onerror(err);
      // 往外抛才能让 fetchEventSource 停止重连。原样抛出拿到的错误——从前是
      // `new Error(err)`，err 是对象时消息会变成 "[object Object]"，把真正的失败原因擦掉。
      throw err;
    },
    openWhenHidden: true,
  });

  return controller;
}
