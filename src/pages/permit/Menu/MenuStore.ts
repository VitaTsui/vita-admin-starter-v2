import { TreeData } from "@hsu-react/ui";
import {
  MenuData,
  MenuSearchData,
  deleteMenu,
  getMenuList,
} from "@/services/apis/permit/menu";

import ListPanelStore from "@/stores/basisStoreClass/ListPanelStore";
import ensureIcons, { collectIcons } from "@/utils/ensureIcons";
import { computed, makeObservable, observable } from "mobx";

class MenuStore extends ListPanelStore<MenuSearchData, MenuData> {
  protected accessor _modeType = {
    cat: "EQ",
  };

  @computed
  get menuTree() {
    return this._menuTree;
  }
  @observable
  private accessor _menuTree: TreeData[] = [];

  @computed
  get expandedIds() {
    return this._expandedIds;
  }
  @observable
  private accessor _expandedIds: string[] = [];

  constructor() {
    super();
    makeObservable(this);
  }

  /**
   * Fetch list
   */
  public getDataSource = () => {
    this._query.toR("type", "1,2", "IN");

    getMenuList({ query: this._query.value }).then((res) => {
      const data = res.data;
      this._dataSource = data.list;

      // 这里列的是全量菜单表，图标范围比当前用户的菜单树更大（还包括别人才看得到的菜单），
      // 所以列表页要自己兜一次，不能指望 RouterService 那一次调用
      void ensureIcons(collectIcons(this._dataSource));

      this._menuTree = this._formatTree(
        this._dataSource as Required<MenuData>[]
      );
      this._expandedIds = this._getExpandedIds(
        this._dataSource as Required<MenuData>[]
      );

      this._isLoading = false;
    });
  };
  // Format the menu list
  private _formatTree = (list: Required<MenuData>[]) => {
    const node: TreeData[] = [];

    list?.forEach((item) => {
      if (!item.perm) {
        let children: TreeData[] = [];

        if (item.children) {
          children = this._formatTree(item.children);
        }

        node.push({
          title: item.nm,
          key: item.id,
          value: item.id,
          children: children.length > 0 ? children : undefined,
        });
      }
    });

    return node;
  };
  // Get expanded ids
  private _getExpandedIds = (list: Required<MenuData>[]) => {
    const ids: string[] = [];

    list?.forEach((item) => {
      if (item.children) {
        const _ids = this._getExpandedIds(item.children);
        ids.push(item.id.toString(), ..._ids);
      }
    });

    return ids;
  };

  /**
   * Delete
   * @param id
   */
  public delData = (id: number | string) => {
    deleteMenu(id).then((res) => {
      if (res.code === 0) {
        this.getDataSource();
      }

      this._message(res);
    });
  };
}

export default new MenuStore();
