import { get } from "../Axios";

// Get the menu list
export interface MenuListData {
  topMenuList: MenuList[];
  menuList: MenuList[];
  topId: null;
  topList: null;
}
/**
 * 菜单节点，形状对齐后端那张菜单表的记录：
 * - `type` 0＝菜单 / 1＝功能点。两类同树存放，但接口分开返——本接口只给菜单，
 *   功能点的权限码走 getPermissions()
 * - `status` 0/null＝在侧栏显示，1＝只注册路由不显示（见 RouterService 的 `menu: !item.status`），
 *   带路由参数的详情页就靠它
 * - `cat` 菜单形态：0＝普通，1＝次级菜单根（进入其子树后整个侧栏换成那些子页）
 */
export interface MenuList {
  id: string;
  nm: string;
  pid: string | null;
  seq: number;
  level: number;
  children: MenuList[] | null;
  path: string;
  url: string;
  perm: string;
  icon: string;
  status: number | null;
  rmks?: string | null;
  type?: 0 | 1;
  cat?: number;
}
export const getMenuList = async (
  params: { project: number } = { project: 0 }
) => {
  return await get<MenuListData>("/sys/menu/getMenuATopATopMenu", { params });
};

// Get permission info
export interface PermissionsInfo {
  stringPermissions: string[];
}
export const getPermissions = async (
  params: { project: number } = { project: 0 }
) => {
  return await get<PermissionsInfo>("/sys/menu/getStringPermissions", {
    params,
  });
};
