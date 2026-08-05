/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 生成精简版 iconify 图标集
 *
 * 扫描 src 下所有 ts/tsx，提取形如 "prefix:icon-name" 的字面量，
 * 在对应图标集里查证（含 alias 解析），只把命中的图标写进
 * src/assets/iconify/collections.generated.json。
 *
 * 为什么需要：@iconify/json 完整图标集有几百 MB，若在入口 addCollection 整集注册，
 * 会全部进首屏；而源码里实际写死的图标只有几十个。
 *
 * 运行时由用户选择的动态图标（后端下发的菜单图标等）无法静态分析，
 * 由 src/index.tsx 里对 IconSelect 那四套图标集的异步整集加载兜底。
 *
 * 用法：yarn gen:icons（start / build 前会自动执行）
 */

const fs = require("fs");
const path = require("path");

/**
 * 项目里会用到的图标集前缀，按需增减。
 * 前四套与 hsu-ui IconSelect 提供的选项一致（菜单图标的取值范围），
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
  const collections = [];
  const missing = [];
  let total = 0;

  for (const prefix of PREFIXES) {
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
      if (resolveIcon(source, target, name)) hit += 1;
      else missing.push(`${prefix}:${name}`);
    }

    if (hit > 0) {
      collections.push(target);
      total += hit;
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(collections), "utf8");

  const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(
    `[gen:icons] 已生成 ${collections.length} 个精简图标集、${total} 个图标，共 ${size} KB`
  );
  if (missing.length) {
    console.log(
      `[gen:icons] 以下字面量看起来像图标名但集合里不存在，已忽略：\n  ${missing.join("\n  ")}`
    );
  }
}

main();
