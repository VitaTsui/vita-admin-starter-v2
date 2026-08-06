import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { MenuType } from "..";
import { checkPathMatch } from "../_utils/pathMatch";

interface UseMenuPathOptions {
  allItems: MenuType[];
  collapsed: boolean;
  mode?: string;
}

/**
 * Hook that handles menu path matching and active state
 */
export const useMenuPath = ({
  allItems,
  collapsed,
  mode = "inline",
}: UseMenuPathOptions) => {
  const location = useLocation();
  const [menuKey, setMenuKey] = useState("");
  const [openKeys, setOpenkeys] = useState<string[]>([]);

  useEffect(() => {
    // 菜单里实际存在的 key，用来判断高亮能不能落上去
    const knownKeys = new Set<string>();
    const collect = (items?: MenuType[]) =>
      items?.forEach((i) => {
        if (i.key) knownKeys.add(i.key);
        collect(i.children);
      });
    collect(allItems);

    const _checkPath = (items: MenuType[], parents?: MenuType[]) => {
      const pathname = decodeURI(location.pathname);

      items?.forEach((item) => {
        if (item.children) {
          const _parents = parents ? [...parents, item] : [item];
          _checkPath(item.children, _parents);
        } else {
          const isMatch = checkPathMatch(pathname, item.key, item.parent?.path);

          if (isMatch) {
            // 判断「这一项本身是不是带参详情页」，只能看它**相对父级的那一段**：
            // 整条 key 里含 ":" 是不够的，父路径带参时（子页的 key 都形如
            // /admin/xxx/:id/detail）会把普通子页全判成详情页，高亮集体落到容器上。
            const selfSeg = item.parent?.path
              ? item.key.slice(item.parent.path.length)
              : item.key;

            if (selfSeg.includes(":")) {
              // 详情页自己不在菜单里，高亮回落到它对应的列表页：去掉末尾参数段后
              // **逐段上退**，直到退到一个菜单里真有的项。只退一段是不够的——
              // /a/b/detail/:id 退一段是 /a/b/detail，菜单里没有这一项，还要再退一段。
              let candidate = item.key.replace(/\/:[^/]+$/, "");
              while (candidate && !knownKeys.has(candidate)) {
                candidate = candidate.slice(0, candidate.lastIndexOf("/"));
              }
              setMenuKey(candidate || item.parent?.path || item.key);
            } else {
              setMenuKey(item.key);
            }

            // Set the expanded menu items
            if (parents && !collapsed && mode !== "horizontal") {
              const _openKeys = parents?.map((item) => item.key);
              setOpenkeys([..._openKeys]);
            }
          }
        }
      });
    };

    setMenuKey("");
    setOpenkeys([]);
    _checkPath(allItems);
  }, [allItems, location, collapsed, mode]);

  return { menuKey, setMenuKey, openKeys, setOpenkeys };
};
