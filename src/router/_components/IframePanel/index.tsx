import React, { Suspense, lazy } from "react";

import PageLoading from "../PageLoading";

/**
 * 外链/内嵌路由菜单用的 Panel.Iframe 包装。
 *
 * 存在的唯一理由是把 `Panel` 挡在入口图之外。RouterService 属于入口图，直接
 * `import { Panel } from "@hsu-react/ui"` 会顺着 Panel → Search → FormItem 把全部
 * 字段渲染器（FormEditor→wangeditor、FormCodeMirror→codemirror、FilePreview→pdfjs、
 * Spreadsheet→xlsx）和 Chart→echarts 一起钉进首屏。实测差异：去掉这层包装，首屏从
 * 85 个 script / 965 KB(gzip) 涨回 126 个 / 2913 KB。
 *
 * 而这条 iframe 分支只有后端菜单配了外链或内嵌路由时才渲染，绝大多数会话走不到。
 *
 * 注意用的是深路径 import，而不是 `import("@hsu-react/ui").then(m => m.Panel.Iframe)`
 * ——后者会把整个 barrel 拉进这个异步块，等于什么都没省。
 */
const LazyIframePanel = lazy(
  () => import("@hsu-react/ui/es/components/Panel/IframePanel")
);

export interface IframePanelProps {
  /** 外链地址；与 children 二选一 */
  src?: string;
  /** 内嵌的既有路由元素；与 src 二选一 */
  children?: React.ReactNode;
}

const IframePanel: React.FC<IframePanelProps> = ({ src, children }) => (
  <Suspense fallback={<PageLoading />}>
    <LazyIframePanel src={src} fullBtn>
      {children}
    </LazyIframePanel>
  </Suspense>
);

export default IframePanel;
