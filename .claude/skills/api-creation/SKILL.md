---
name: api-creation
description: Use this skill when creating, adding, or modifying API modules under `src/services/apis/` in any project that has `src/services/Axios.ts` exporting `get`/`post`/`del`/`put` and `src/services/ResType.ts` exporting `ListRes`. Trigger phrases include "新增一个接口"、"创建 API"、"add a CRUD api"、"在 services/apis 下新增模块"、"新增一个模块的增删改查", or any request to wire up backend endpoints for a list/detail/create/update/delete page. Skip for API usage inside `pages/`/`components/` — this skill is only for authoring files inside `src/services/apis/`. The skill adapts to the current project's own directory structure rather than assuming a fixed set of categories.
---

# API 创建规范 (src/services/apis)

本 skill 规范 `src/services/apis/` 下 API 文件的创建方式，确保与项目现有风格一致。

## 先决条件 — 先读这些

每次创建 API 前，必须先确认项目具备以下基础设施（若缺失，则此 skill 不适用）：

- `src/services/Axios.ts`：导出 `get`、`post`、`del`、`put`、`streamRequest`，以及 `ResType<T>` 接口。`get`/`post` 返回 `Promise<ResType<T>>`，其中 `T` 是业务 data 的类型。
- `src/services/ResType.ts`：导出 `ListRes<T>`（`{ list, page: { pageNum, pageSize, total } }`）和 `FileRes`（`{ filename, data }`）。
- `src/services/Query.ts`：查询条件构造器，通常以 `new Query().value` 的形式作为 `params.query` 传入列表接口。

导入路径固定使用别名 `@/services/Axios` 和 `@/services/ResType`，**不要**使用相对路径（`../Axios`）——后者仅在 `apis/` 根下的旧文件存在，新文件一律走别名。

## 模块文件的骨架

每个 API 模块（对应一个业务功能，如"API 黑名单管理"）是一个独立的 `.ts` 文件，遵循统一骨架：

```ts
/**************************************
 * Module Name : <中文模块名>
 **************************************/

import { get, post } from "@/services/Axios";

import { ListRes } from "@/services/ResType";

// 表单/页面搜索态类型 —— 供页面组件使用，字段宽松
export interface XxxSearchData extends Record<string, unknown> {
  // 具体字段...
}

// 请求参数类型 —— 实际发给后端的 query 参数形状
interface XxxSearch extends Record<string, unknown> {
  query: string;
  // 其它可选查询字段...
}

// 实体完整形状 —— 定义为 internal interface，再用 Partial 暴露
interface IXxxData {
  id: string | number;
  // ... 后端返回的所有字段，类型尽量精确
}
export type XxxData = Partial<IXxxData>;

// 列表
export const getXxxList = async (params: XxxSearch) => {
  return await get<ListRes<XxxData>>("/<模块前缀>/page", { params });
};

// 详情
export const getXxx = async (id: number | string) => {
  return await get<XxxData>("/<模块前缀>/info/" + id);
};

// 新增
export const createXxx = async (data: XxxData) => {
  return await post("/<模块前缀>/add", data);
};

// 修改
export const editXxx = async (data: XxxData) => {
  return await post("/<模块前缀>/upd", data);
};

// 删除
export const deleteXxx = async (id: number | string) => {
  return await get("/<模块前缀>/del", { params: { ids: id } });
};
```

## 命名规范（必须严格遵守）

### 目录和文件名 — 必须与页面路径一一镜像

**页面就是大类。** `src/services/apis/` 下的目录/文件结构必须与 `src/pages/` 下对应页面的路径一一对应，文件名就是页面模块目录名的"全小写连写"形式。

| 页面路径 | 对应 API 路径 |
|---|---|
| `src/pages/HeatmapManagement/` | `src/services/apis/heatmapmanagement.ts` |
| `src/pages/EnergyReport/` | `src/services/apis/energyreport.ts` |
| `src/pages/informationMaintenance/HonorManagement/` | `src/services/apis/informationmaintenance/honormanagement.ts` |
| `src/pages/gbhx/RoleManagement/` | `src/services/apis/gbhx/rolemanagement.ts` |
| `src/pages/gbhx/MenuManagement/` | `src/services/apis/gbhx/menumanagement.ts` |

规则：
- **大类目录 = 页面大类目录**：页面有多少层 category，API 目录就有多少层（同名，全小写）。
- **文件名 = 页面模块目录名的全小写连写**：去掉空格/连字符/驼峰，例如页面 `HeatmapManagement/` → API 文件 `heatmapmanagement.ts`，页面 `PersRoleBinding/` → `persrolebinding.ts`。
- **不要起泛名**：`menu.ts`、`role.ts`、`auth.ts` 这种名字与页面模块名不对应、容易和项目其它概念撞义，禁止使用。
- **跨页面共享的 API**（比如登录、改密、全局权限探测等没有对应业务页面的接口）直接放在 `src/services/apis/` 根下，用 `login.ts`、`pwdchange.ts`、`permit.ts` 这种语义清晰的短名。
- **复杂模块（页面目录下有子页面）**：API 目录结构也跟着嵌套。如页面 `ApiMetadataManagement/ApiMetadataDetail/` 对应 API `apimetadatamanagement/apimetadatadetail.ts`（或继续平铺 `apimetadatamanagementdetail.ts`，取决于子页面是否独立调用自己的一组 CRUD 接口）。

### 其它命名

- **类型名（PascalCase）**：
  - 页面表单搜索态：`XxxSearchData`（导出，`extends Record<string, unknown>`）
  - 请求 search 参数：`XxxSearch`（内部 interface，`extends Record<string, unknown>`，`query: string` 通常必填）
  - 实体全字段：`IXxxData`（internal，前缀 `I`）
  - 对外暴露的实体：`XxxData = Partial<IXxxData>`（导出 type 别名）
- **函数名（camelCase，CRUD 固定前缀）**：
  - 列表 → `getXxxList`
  - 详情 → `getXxx`
  - 新增 → `createXxx`
  - 修改 → `editXxx`
  - 删除 → `deleteXxx`
  - 状态变更 → `updateXxxStatus`
  - 批量操作 → `batchSaveXxxRole` 等，语义前缀 + 动作

## 方法与 URL 约定

**先看后端是哪一套**——脚手架式（`/add` `/upd` `GET /del?ids=`）与 REST 式（`POST` `PATCH` `DELETE` ＋ `If-Match`）在同一份规范里并存，取决于本项目后端的真实契约。新增模块时读同目录既有文件对齐，不要照搬另一套。

### A. 脚手架式（Java 后端惯例）

- 列表：`GET /<模块前缀>/page`，`params` 携带 `query`（由 `Query` 类编码）
- 详情：`GET /<模块前缀>/info/{id}` 或 `GET /<模块前缀>/dtl`
- 新增：`POST /<模块前缀>/add`
- 修改：`POST /<模块前缀>/upd`（少数模块新增/修改共用 `/save`）
- 删除：`GET /<模块前缀>/del?ids={id}`（删除走 GET、参数名 `ids`，与直觉相反但这是该套约定）
- 枚举/下拉：`GET /<模块前缀>/list`

### B. REST 式（本项目 Rust 后端即此套）

- 列表：`GET /q/<资源>`，`params.query` 同样由 `Query` 类编码；非分页清单走各自的 `GET /<复数资源>`
- 详情：`GET /<复数资源>/{id}`
- 新增：`POST /<复数资源>`
- 修改：`PATCH /<复数资源>/{id}`，**乐观锁走 `If-Match` 请求头**，不是 body 字段：
  ```ts
  export const editXxx = async (data: XxxData) => {
    const { id, version, ...rest } = data;
    return await patch(`/xxx/${id}`, rest, {
      headers: { "If-Match": String(version) } as unknown as AxiosHeaders,
    });
  };
  ```
  解构剔除只读字段时，被剔除的绑定要加 `_` 前缀（`item_count: _itemCount`），否则触发 `no-unused-vars`；键名不变，排除逻辑照旧。
- 删除：`DELETE /<复数资源>/{id}`（从 `@/services/Axios` 导入 `del`）
- 子资源：`GET/POST /<父资源>/{id}/<子资源>`

**详情端点是弹窗回填的前提，缺了就补。** 抽表单弹窗时若发现某资源只有列表接口、没有 `GET /<复数资源>/{id}`，不要退化成父页面 props 传整行（理由见 page-creation「缺详情接口时不要用 props 传整行」），而是推动后端补上、并在本文件里导出：

```ts
// 详情：表单按 id 回填
export const getXxx = async (id: number | string) => {
  return await get<XxxData>(`/xxx/${id}`);
};
```

本项目为此补过 6 个：`/volumes/{id}`、`/tombstones/{id}`、`/mcp-tokens/{id}`、`/status/{id}`、`/material-groups/{id}`、`/materials/items/{id}`。注意路径要跟着后端真实路由走——素材是 `/materials/items/{id}` 而不是 `/materials/{id}`。

**409 冲突封套**：`PATCH` 撞乐观锁时后端返回 409，并把服务端最新整行放在 `data.error.details.current`。API 文件本身不处理它（拦截器与 store 负责），但**要在函数上方注释里点明该接口带乐观锁**，便于调用方知道要接冲突恢复：

```ts
// 修改（乐观锁：If-Match 版本，不匹配返回封套 code 409 ＋ 服务端当前内容）
```

### 写接口顺带推进了别的资源的 version → 必须回传新版本号

一个写接口除了改自己那张表，往往还会更新关联行的派生列。**只要那次 UPDATE 带了 `version = version + 1`，响应就必须把新版本号交回来**，否则调用方手里的版本立刻过期，而它没有任何正当办法拿到新的。

真实案例（某写作类项目）：`PUT /chapters/{id}/body` 存正文时，顺带 `UPDATE chapter SET han_count, para_count, status, version = version + 1`（字数段数是正文的派生列），但响应只回了 doc 的版本号。结果是每存一次草稿、客户端手里的 `chapter.version` 就落后一版，**定稿必 409**。前端为了绕过去，在提交前重新拉一次章去「补版号」——那正是 page-creation 里点名禁止的 lost update，把乐观锁整个废掉了。

后端写法（`RETURNING` 拿回新版本，放进响应）：

```rust
let (chapter_version,): (i32,) = sqlx::query_as(
    "UPDATE chapter SET han_count = $2, para_count = $3, version = version + 1 \
     WHERE id = $1 RETURNING version",
)
.bind(id).bind(han).bind(paras)
.fetch_one(&mut *tx)
.await?;

Ok(ok(json!({
    "doc_id": doc_id, "version": doc_version, "chapter_version": chapter_version,
    // …
})))
```

前端侧在返回类型里声明出来，并在注释里说明它是什么、调用方要拿它干嘛：

```ts
// 返回的 version 是正文页的新版本，chapter_version 是章行的新版本——存正文会顺带
// 推进章行（字数/段数/状态是正文的派生列），调用方必须两个都记下来，否则定稿时
// 手里的章版本已经过期，只能重新拉一次章来补版号（那就是废掉乐观锁的 lost update）。
export const putChapterBody = async (id: string, body: ProseDoc, version: number) => {
  return await put<{
    doc_id: string;
    version: number;
    chapter_version: number;
    han_count: number;
    para_count: number;
  }>(`/chapters/${id}/body`, { body }, {
    headers: { "If-Match": String(version) } as unknown as AxiosHeaders,
  });
};
```

**自查**：写完一个写接口，问一句「它有没有 bump 除自己外的 version？」有就必须回传。

### 权限码必须在后端 `permissions()` 的全集里

页面按钮的 `hasPermi` 用了一个后端不下发的码，`usePermissions` 会判定无权 → **按钮永久隐藏，没有任何报错**。而且 `permissions` 尚未加载时它返回 `true`，现象是「按钮闪一下就没了」，比彻底不显示更难查。

新增受权限门控的按钮时，同步在后端维护权限码全集的那张表里确认/补齐对应模块（本项目在哪个文件，第一次查时确认一次）：

```rust
("work:outline", &["query", "add", "upd", "del"]),
```

审计时把前端所有 `hasPermi` 的码抓出来与后端全集做差集，**前端多出来的都是 bug**（后端多下发的无害）。

## 两种常见 API 形态的选择

1. **完整 CRUD 模块**：用上面的完整骨架。
2. **只读枚举/下拉**（若项目存在 `apis/enum.ts`，应归并进去，而**不是**新建文件）：
   ```ts
   export const getXxxList = async () => {
     return await get<ListRes<{ id: string | number; nm: string }>>("/<path>/list");
   };
   ```
   新增此类枚举前，先查看 `apis/enum.ts` 是否已有类似函数或合适位置。

## 返回类型

- 列表：**看后端返回的键名**。分页接口返回 `{ list, page }` → 用 `ListRes<XxxData>`；本项目 REST 后端的非分页清单返回的是 `{ items }`（键名不是 `list`），套 `ListRes` 就是错的类型，此时手写 `get<{ items: XxxData[] }>(...)` 是正确做法。真正要避免的是同一形状在各文件反复内联——若同项目 `{items}` 出现十余处，应在 `src/services/ResType.ts` 补一个 `ItemsRes<T>` 统一引用。
- 列表（键名为 `list` 时）：统一用 `get<ListRes<XxxData>>(...)`——**分页和非分页 list 接口都用同一个 `ListRes<T>` 泛型**。后端对非分页接口只返 `{ list }` 不返 `page` 是常见情况；前端侧仍然套 `ListRes<T>`，消费者按需取 `list` 即可，不要另造 `{ list: T[] }` 这种手写形状（会让类型在项目里碎片化）。只在消费端真要用 `page` 字段时再做 `page?.total ?? 0` 之类的可选访问。
- 详情/单对象：`get<XxxData>(...)` 或 `post<XxxData>(...)`
- 无业务 data：省略泛型，`post(...)` 即可——返回 `ResType<undefined>`
- 文件下载：调用方在 `config` 中传 `responseType: "blob"`/`"arraybuffer"`，此时响应会被 `Axios.ts` 自动包装成 `FileRes`（`{ filename, data }`），类型写 `get<FileRes>(...)`（需要 `import { FileRes } from "@/services/ResType"`）。
- 流式 SSE：使用 `streamRequest`，不要套 `get`/`post`。

## 导入与样式细节

- `import { get, post } from "@/services/Axios";` 和 `import { ListRes } from "@/services/ResType";` 之间保留**一个空行**——这是项目里 CRUD 文件的固定写法。
- 模块名注释块（`/************** Module Name : ... **************/`）放在所有 import 之前。
- 不要在文件里写 `// TODO`、`// FIXME` 之类的占位注释。
- 不要手写请求拦截、token 注入、错误提示——这些都在 `Axios.ts` 里统一处理。

## 编写流程（Claude 应遵循）

当用户要求新增一个 API 模块时：

1. **确定对应页面路径**：该 API 是给哪个页面用的？先拿到 `src/pages/<...>/<ModuleName>/` 的完整路径。若还没有对应页面（纯跨页共享 API、登录/改密等全局入口），才允许脱离页面镜像规则，平铺在 `src/services/apis/` 根下。
2. **按页面路径镜像推导 API 路径**：页面 `src/pages/A/B/<ModuleName>/` → API `src/services/apis/a/b/<modulename>.ts`（大类目录 = 页面大类全小写；文件名 = 页面模块名全小写连写）。
3. 用 Glob 检查**当前项目** `src/services/apis/` 的现有结构，确认镜像目标是否已存在——存在则直接新增文件；不存在则同时新建镜像目录。如果既有文件名偏离了镜像规则（例如 `menu.ts` / `role.ts` 这种泛名），在审计/Review 时应提示重命名。
4. 读取同目录下 **1 个** 最相近的既有 CRUD 文件，以其为模板——这可以捕获本目录可能有的微小风格差异。
5. 从用户提供的字段/接口定义中提炼 `IXxxData`、`XxxSearch`、`XxxSearchData`。未知字段留到后续再补，不要瞎编。
6. 产出文件，文件名遵循"全小写连写 + 镜像页面模块名"规则。
7. 不要主动在 `index.ts` 做再导出——项目不使用 barrel 文件。调用处直接 `import { getXxxList } from "@/services/apis/<dir>/<file>"`。
8. 创建后**不要**运行 lint/build 除非用户要求——这些接口文件通常会被页面引用后才编译到。

## 反例（常见错误，避免）

- ❌ 用相对路径 `import { get } from "../../Axios"` —— 应改为 `@/services/Axios`
- ❌ 文件名用驼峰 `apiBlacklistManagement.ts` —— 应改为全小写 `apiblacklistmanagement.ts`
- ❌ 文件名起泛名 `menu.ts`、`role.ts`、`auth.ts` —— 必须镜像页面模块名，如 `menumanagement.ts`、`rolemanagement.ts`；只有真正跨页共享的 API 才允许用短名，且放在 `apis/` 根下
- ❌ API 目录结构与 `src/pages/` 下对应页面路径不一致 —— 页面大类目录必须在 API 层镜像一份
- ❌ 删除接口用 `del("/xxx/del/" + id)` —— 项目统一用 `get("/xxx/del", { params: { ids: id } })`
- ❌ 直接导出 `interface XxxData` —— 应导出 `type XxxData = Partial<IXxxData>`，保留内部 `IXxxData` 作为完整形状
- ❌ 后端返回 `{ list }` 却手写 `{ list: T[] }` 类型 —— 该用 `ListRes<T>`，把碎片化收敛掉（返回 `{ items }` 的接口不适用此条，见「返回类型」）
- ❌ 在 API 文件里写 `try/catch` 或 `notification.error` —— 全局拦截器已处理
- ❌ 把简单的下拉列表接口单独开文件 —— 应追加到 `apis/enum.ts`
- ❌ 在 `apis/` 下放一次性种子/引导脚本（`_initXxx.ts`） —— 脚本属于 `src/utils/` 或项目级 `scripts/`，不进 API 层
- ❌ 抽弹窗时发现缺详情接口就让父页面 props 传整行 —— 应推动后端补 `GET /<复数资源>/{id}` 并在本文件导出 `getXxx`
- ❌ 写接口 bump 了别的资源的 `version` 却不在响应里回传 —— 调用方手里的版本立刻过期，只能靠「提交前重新拉一次」补版号，等于把乐观锁废掉
- ❌ 页面用了后端 `permissions()` 不下发的权限码 —— 按钮永久隐藏且无报错，新增门控按钮时两侧要对齐
- ❌ 在 `get`/`post`/`del` 的封装里就地 `delete params.query` 改调用方传入的对象 —— 调用方若传的是 store 持有的稳定对象，`query` 会被永久删掉，第二次请求静默变成无条件全量查询；应解构出 rest
- ❌ 保留脚手架残留的死分支 —— 如按 `res.data.header.code` 判 401（本项目封套是 `{code,msg,data}`，没有 `header` 这层）、写死别的产品的请求头
