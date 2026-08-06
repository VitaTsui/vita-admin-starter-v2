/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 生成精简版 iconify 图标集
 *
 * 输入有两处，取并集：
 * 1. 扫描 src 下所有 ts/tsx，提取形如 "prefix:icon-name" 的字面量（源码里写死的）；
 * 2. scripts/extraIcons.cjs —— 后端下发的菜单图标，由 scripts/syncMenuIcons.cjs 生成。
 *
 * 两者都在对应图标集里查证（含 alias 解析），只把命中的图标写进
 * src/assets/iconify/collections.generated.json。
 *
 * 扫描是纯文本匹配、不区分注释与代码：注释里写成 "prefix:icon-name" 的示例也会
 * 被当真收进来（体积代价可忽略，但别为此困惑）。
 *
 * 为什么需要：@iconify/json 完整图标集有几百 MB，若在入口 addCollection 整集注册，
 * 会全部进首屏；而实际用到的只有几十上百个。
 *
 * 菜单图标为什么不能靠运行时兜底了事：它们必须随首屏就位，否则侧边菜单先空白一拍。
 * 兜底（src/utils/ensureIcons.ts）只负责「配了新图标但前端还没重跑本脚本」这种漏网情况。
 *
 * 用法：yarn gen:icons（start / build 前会自动执行）
 */

const fs = require("fs");
const path = require("path");

/**
 * 源码扫描的图标集前缀白名单，按需增减。
 *
 * 只对「源码扫描」这一路生效：`"a:b"` 这种字面量在代码里满地都是（时间、比例、
 * CSS 值……），没有白名单会捞回一堆假图标名。菜单图标那一路不受此限制 ——
 * extraIcons.cjs 里的每一项都是确凿的 icon 字段值，前缀直接采信。
 *
 * 前四套与 hsu-ui IconSelect 提供的选项一致（管理员在菜单管理里能选到的范围），
 * 其余是本项目源码里实际用到的。
 */
const PREFIXES = [
  "ant-design",
  "ep",
  "fa",
  "fa-solid",
  "fa-regular",
  "carbon",
  "ph",
  "material-symbols",
];

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const JSON_DIR = path.join(ROOT, "node_modules", "@iconify", "json", "json");
const OUT_DIR = path.join(SRC_DIR, "assets", "iconify");
const OUT_FILE = path.join(OUT_DIR, "collections.generated.json");

/** IconifyJSON 顶层可选的默认属性，需要一并保留，否则图标尺寸会错 */
const ROOT_KEYS = ["width", "height", "left", "top", "rotate", "hFlip", "vFlip"];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "assets") continue;
      walk(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectCandidates() {
  const re = /["'`]([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g;
  const byPrefix = new Map();

  for (const file of walk(SRC_DIR)) {
    const code = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(code))) {
      const [, prefix, name] = m;
      if (!PREFIXES.includes(prefix)) continue;
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
      byPrefix.get(prefix).add(name);
    }
  }

  return byPrefix;
}

/** 读取菜单图标清单（生成物，可能还没生成过） */
function loadExtraIcons() {
  const file = path.join(__dirname, "extraIcons.cjs");
  if (!fs.existsSync(file)) return [];

  try {
    const list = require(file);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn(`[gen:icons] 读取 extraIcons.cjs 失败，已忽略：${err.message}`);
    return [];
  }
}

/**
 * 把菜单图标并进候选集，返回它们的全名集合（用于区分报错措辞：
 * 菜单图标漏掉是线上空白图标，源码里的假阳性只是噪音）
 */
function mergeExtraIcons(byPrefix) {
  const fromMenu = new Set();

  for (const full of loadExtraIcons()) {
    if (typeof full !== "string") continue;
    const idx = full.indexOf(":");
    if (idx <= 0) continue;

    const prefix = full.slice(0, idx);
    const name = full.slice(idx + 1);
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
    byPrefix.get(prefix).add(name);
    fromMenu.add(full);
  }

  return fromMenu;
}

/**
 * 提醒 src/utils/ensureIcons.ts 的 LOADERS 缺哪些前缀。
 * 缺了不影响本次产物（图标已经裁进精简集），但那一套失去了运行时兜底能力 ——
 * 将来有人在菜单管理里配了该集合的新图标、前端又没重跑本脚本，就是空白图标。
 */
function checkLoaders(prefixes) {
  const file = path.join(SRC_DIR, "utils", "ensureIcons.ts");
  if (!fs.existsSync(file)) return;

  const code = fs.readFileSync(file, "utf8");
  const declared = new Set(
    [...code.matchAll(/@iconify\/json\/json\/([a-z0-9-]+)\.json/g)].map(
      (m) => m[1]
    )
  );
  const lack = prefixes.filter((prefix) => !declared.has(prefix));

  if (lack.length) {
    console.log(
      `[gen:icons] 以下集合在 src/utils/ensureIcons.ts 的 LOADERS 里没有对应加载器，将失去运行时兜底：\n  ${lack.join("\n  ")}`
    );
  }
}

/** 把一个图标（可能是 alias）连同它的 parent 链一起收进结果 */
function resolveIcon(source, target, name, seen = new Set()) {
  if (seen.has(name)) return false; // 防御 alias 成环
  seen.add(name);

  if (source.icons?.[name]) {
    target.icons[name] = source.icons[name];
    return true;
  }

  const alias = source.aliases?.[name];
  if (alias) {
    target.aliases = target.aliases || {};
    target.aliases[name] = alias;
    return alias.parent ? resolveIcon(source, target, alias.parent, seen) : true;
  }

  return false;
}

function main() {
  if (!fs.existsSync(JSON_DIR)) {
    console.error(
      `[gen:icons] 找不到 ${path.relative(ROOT, JSON_DIR)}，请先安装依赖（@iconify/json）`
    );
    process.exit(1);
  }

  const candidates = collectCandidates();
  const fromMenu = mergeExtraIcons(candidates);

  const collections = [];
  const resolvedPrefixes = [];
  const missing = [];
  const missingFromMenu = [];
  let total = 0;
  let menuHit = 0;

  // 白名单在前、菜单图标带来的新集合在后；菜单图标很容易溢出 IconSelect 的四套
  // 取值范围（历史数据、直接写库、早期用别的方式配置），所以这里不做前缀过滤
  const prefixes = [...new Set([...PREFIXES, ...candidates.keys()])];

  for (const prefix of prefixes) {
    const names = candidates.get(prefix);
    if (!names || names.size === 0) continue;

    const file = path.join(JSON_DIR, `${prefix}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`[gen:icons] 找不到图标集 ${prefix}.json，跳过`);
      continue;
    }

    const source = JSON.parse(fs.readFileSync(file, "utf8"));
    const target = { prefix, icons: {} };
    for (const key of ROOT_KEYS) {
      if (source[key] !== undefined) target[key] = source[key];
    }

    let hit = 0;
    for (const name of names) {
      const full = `${prefix}:${name}`;
      if (resolveIcon(source, target, name)) {
        hit += 1;
        if (fromMenu.has(full)) menuHit += 1;
      } else if (fromMenu.has(full)) {
        missingFromMenu.push(full);
      } else {
        missing.push(full);
      }
    }

    if (hit > 0) {
      collections.push(target);
      resolvedPrefixes.push(prefix);
      total += hit;
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(collections), "utf8");

  const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(
    `[gen:icons] 已生成 ${collections.length} 个精简图标集、${total} 个图标（含菜单图标 ${menuHit}/${fromMenu.size} 个），共 ${size} KB`
  );
  if (missingFromMenu.length) {
    // 菜单里配了、图标集里却没有：线上就是一个空白图标，得回菜单管理改掉
    console.warn(
      `[gen:icons] 以下菜单图标在图标集里不存在，页面上会是空白：\n  ${missingFromMenu.join("\n  ")}`
    );
  }
  if (missing.length) {
    console.log(
      `[gen:icons] 以下字面量看起来像图标名但集合里不存在，已忽略：\n  ${missing.join("\n  ")}`
    );
  }
  checkLoaders(resolvedPrefixes);
}

main();
