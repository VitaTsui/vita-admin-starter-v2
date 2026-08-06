import {
  addCollection,
  iconLoaded,
  IconifyJSON,
} from "@iconify/react/dist/iconify.js";

/**
 * prefix → 整集加载器。
 *
 * 必须写成字面量 import()：写成 import(`@iconify/json/json/${prefix}.json`) 会让
 * webpack 把 @iconify/json 整个目录（200+ 个集合、几百 MB）都编成异步 chunk 打进产物。
 *
 * 这份映射要和 scripts/genIconCollections.cjs 的 PREFIXES 保持一致 ——
 * gen:icons 跑完会提示缺了哪些。
 */
const LOADERS: Record<string, () => Promise<unknown>> = {
  "ant-design": () => import("@iconify/json/json/ant-design.json"),
  ep: () => import("@iconify/json/json/ep.json"),
  fa: () => import("@iconify/json/json/fa.json"),
  "fa-solid": () => import("@iconify/json/json/fa-solid.json"),
  "fa-regular": () => import("@iconify/json/json/fa-regular.json"),
  carbon: () => import("@iconify/json/json/carbon.json"),
  ph: () => import("@iconify/json/json/ph.json"),
  "material-symbols": () => import("@iconify/json/json/material-symbols.json"),
};

/**
 * Recursively collect the icon names configured on a menu-like tree
 *
 * 菜单树在项目里有两种形状（路由用的 MenuList、菜单管理用的 MenuData），
 * 这里只约束「有 icon、有 children」，两边都能直接喂进来
 */
export function collectIcons<
  T extends { icon?: string; children?: T[] | null },
>(nodes: T[] | null | undefined, acc: string[] = []): string[] {
  nodes?.forEach((node) => {
    if (node.icon) acc.push(node.icon);
    if (node.children?.length) collectIcons(node.children, acc);
  });

  return acc;
}

/** 已经补过整集的前缀（含进行中的），避免同一套被拉两次 */
const loading = new Map<string, Promise<void>>();

function loadCollection(prefix: string): Promise<void> {
  const pending = loading.get(prefix);
  if (pending) return pending;

  const task = LOADERS[prefix]()
    .then((module) => {
      const collection = (module as { default?: IconifyJSON }).default ?? module;
      addCollection(collection as IconifyJSON);
    })
    .catch((err) => {
      // 补不上就让它保持空白，不要连累调用方
      console.warn(`[ensureIcons] 图标集 ${prefix} 加载失败`, err);
      loading.delete(prefix);
    });

  loading.set(prefix, task);
  return task;
}

/**
 * 确保这批图标可用，只对真正缺失的集合异步补一整套。
 *
 * 用于后端下发的动态图标（菜单图标等）：它们理应已经被 scripts/syncMenuIcons.cjs
 * 固化、由 gen:icons 裁进精简集，此时这里**一个请求都不会发**。真正兜的是
 * 「有人在菜单管理里配了新图标，而前端还没重跑 gen:icons」—— 补一整套总好过空白。
 *
 * 比无条件预加载 IconSelect 那四套（约 1.9 MB）既省流量，覆盖面又更全：
 * 菜单图标很容易溢出那四套的范围（历史数据、直接写库、早期用别的方式配置）。
 *
 * 但它只是兜底：补的是一整套，个别集合体积很大（material-symbols 7.6 MB、ph 4.4 MB），
 * 真走到这一步说明该跑 sync:menu-icons 了。
 *
 * @param names 图标名数组，元素形如 ant-design:home-outlined
 *              （这里刻意不加引号：gen:icons 的扫描不区分注释与代码，
 *              注释里写成字面量的示例会被当成真图标裁进精简集）
 */
export default async function ensureIcons(names: string[]): Promise<void> {
  const wanted = new Set<string>();
  const unknown: string[] = [];

  for (const name of names) {
    if (!name || !name.includes(":")) continue;
    // 精简集里已经有了 —— 绝大多数情况走到这里就结束
    if (iconLoaded(name)) continue;

    const prefix = name.slice(0, name.indexOf(":"));
    // 整集已补过还是没有，说明是图标名本身写错了，补第二遍也没用
    if (loading.has(prefix)) continue;
    if (!LOADERS[prefix]) {
      unknown.push(name);
      continue;
    }

    wanted.add(prefix);
  }

  if (unknown.length) {
    console.warn(
      `[ensureIcons] 以下图标所在的集合没有加载器，会显示为空白：${unknown.join(
        "、"
      )}\n` +
        "补法：往 src/utils/ensureIcons.ts 的 LOADERS 和 scripts/genIconCollections.cjs 的 PREFIXES 各加一行"
    );
  }

  await Promise.all([...wanted].map(loadCollection));
}
