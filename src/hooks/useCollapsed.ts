import { useCallback, useState } from "react";

/**
 * 面板折叠态 ＋ localStorage 记忆。
 *
 * 页面里凡是「这块能收起来，下次进来还记得」的侧板/卡片都用它，别各写一份——
 * 手写两份时最常见的分叉是读取侧的默认值语义相反（一处 `=== "1"` 默认展开、
 * 另一处 `!== "0"` 默认收起），所以这里把它做成显式参数；存的值统一是 "1"/"0"。
 */
export default function useCollapsed(
  key: string,
  defaultCollapsed = false,
): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(key);

    return saved === null ? defaultCollapsed : saved === "1";
  });

  const toggle = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      localStorage.setItem(key, next ? "1" : "0");
    },
    [key],
  );

  return [collapsed, toggle];
}
