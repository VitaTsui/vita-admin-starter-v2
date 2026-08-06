/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 把菜单图标固化成构建输入
 *
 * 菜单图标由管理员在「菜单管理」里配置、存在后端数据库，构建期扫不到源码，
 * 但它们必须随首屏就位，否则侧边菜单出现空白图标。
 *
 * 这个脚本从一份菜单配置（后端 getMenuList 的响应，或导出的菜单 JSON）里递归
 * 提取所有 icon 字段，生成 scripts/extraIcons.cjs；genIconCollections.cjs 会把
 * 它与源码扫描结果取并集后一起裁剪。生成物需要提交进仓库。
 *
 * 用法：
 *   node ./scripts/syncMenuIcons.cjs <菜单 JSON 路径>
 *   yarn gen:icons
 *
 * 菜单图标有增改时重跑一次即可。
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(__dirname, "extraIcons.cjs");

/** 图标名的形状：prefix:icon-name */
const ICON_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 递归收集任意结构里的 icon 字段。
 *
 * 不假设菜单 JSON 的外层形状（可能是数组、可能是 { code, data: { menuList } }、
 * 也可能是别的导出格式），只认 icon 这个键 —— 各种来源都能直接喂进来。
 */
function collectIcons(node, acc = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectIcons(item, acc));
    return acc;
  }
  if (!node || typeof node !== "object") return acc;

  for (const [key, value] of Object.entries(node)) {
    if (key === "icon" && typeof value === "string" && ICON_RE.test(value)) {
      acc.add(value);
    } else if (value && typeof value === "object") {
      collectIcons(value, acc);
    }
  }

  return acc;
}

/** 读回上一份清单，用来报告本次的增减 */
function readPrevious() {
  if (!fs.existsSync(OUT_FILE)) return [];
  try {
    const list = require(OUT_FILE);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function render(icons) {
  const body = icons.map((icon) => `  "${icon}",`).join("\n");

  return `/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 菜单图标清单（生成物，请提交进仓库）
 *
 * 由 scripts/syncMenuIcons.cjs 从菜单配置里提取，genIconCollections.cjs 会把它
 * 与源码扫描结果取并集后一起裁剪进 src/assets/iconify/collections.generated.json。
 *
 * 不要手工编辑：菜单图标有增改时重跑
 *   node ./scripts/syncMenuIcons.cjs <菜单 JSON 路径> && yarn gen:icons
 */

module.exports = [
${body}
];
`;
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error(
      "[sync:menu-icons] 用法：node ./scripts/syncMenuIcons.cjs <菜单 JSON 路径>"
    );
    process.exit(1);
  }

  const file = path.resolve(process.cwd(), input);
  if (!fs.existsSync(file)) {
    console.error(`[sync:menu-icons] 找不到文件 ${file}`);
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`[sync:menu-icons] ${path.relative(ROOT, file)} 不是合法 JSON：${err.message}`);
    process.exit(1);
  }

  const icons = [...collectIcons(json)].sort();
  const previous = readPrevious();
  const added = icons.filter((icon) => !previous.includes(icon));
  const removed = previous.filter((icon) => !icons.includes(icon));

  fs.writeFileSync(OUT_FILE, render(icons), "utf8");

  const byPrefix = new Map();
  for (const icon of icons) {
    const prefix = icon.slice(0, icon.indexOf(":"));
    byPrefix.set(prefix, (byPrefix.get(prefix) || 0) + 1);
  }

  console.log(
    `[sync:menu-icons] 已写入 ${path.relative(ROOT, OUT_FILE)}：${icons.length} 个图标、${byPrefix.size} 个集合`
  );
  if (byPrefix.size) {
    const detail = [...byPrefix.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([prefix, count]) => `${prefix}(${count})`)
      .join("、");
    console.log(`[sync:menu-icons] 分布：${detail}`);
  }
  if (added.length) console.log(`[sync:menu-icons] 新增：${added.join("、")}`);
  if (removed.length) console.log(`[sync:menu-icons] 移除：${removed.join("、")}`);
  console.log("[sync:menu-icons] 接着跑 yarn gen:icons 让它们进精简集");
}

main();
