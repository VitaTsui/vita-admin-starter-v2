import { computed, makeObservable, observable } from "mobx";

import Query, {
  LogicType,
  ModeType,
  OrderType,
  RuleNameType,
} from "@/services/Query";
import FormModalStore from "./FormModalStore";
import { ListRes } from "@/services/ResType";
import { ResType } from "@/services/Axios";
import { message, notification } from "@hsu-react/ui";
import wsCache, { CACHE_KEY } from "@/utils/wsCache";
import { Equal } from "hsu-utils";

export type searchModeType<T> = { [K in keyof T]?: ModeType };
export type searchRNType<T> = { [K in keyof T]?: RuleNameType };
export type searchKTType<T> = { [K in keyof T]?: LogicType };

/**
 * S: search condition type
 * D: list data type
 */
export default class ListPanelStore<
  S = Record<string, unknown>,
  D = Record<string, unknown>
> extends FormModalStore<D> {
  // Request
  protected accessor _query: Query = new Query();

  constructor() {
    super();
    makeObservable(this);
  }

  /**
   * Loading
   */
  @computed
  get isLoading() {
    return this._isLoading;
  }
  @observable
  protected accessor _isLoading: boolean = true;

  /**
   * Sorting
   */
  @computed
  get order() {
    return this._order;
  }
  @observable
  protected accessor _order: { k: string; t: OrderType } | undefined = undefined;
  protected accessor _initOrder: { k: string; t: OrderType } = {
    k: "crtTm",
    t: "desc",
  };
  public onOrderChange = (order?: { k: string; t: OrderType }) => {
    this._order =
      order ||
      (Equal.ObjEqual(this._initOrder, this._order) && !!this._order
        ? undefined
        : this._initOrder);

    this._query.toOArr(this._order ? [this._order] : []);

    this._isLoading = true;
    // Clear the old list before the request to avoid showing stale rows until new data returns
    this._dataSource = [];

    this.getDataSource();
  };

  /**
   * Search
   */
  @computed
  get searchData() {
    return this._searchData;
  }
  @observable
  protected accessor _searchData: Partial<S> = {};
  protected accessor _initSearchData: Partial<S> = {};
  protected accessor _staticSearchData: Partial<S> = {};
  protected accessor _modeType: Partial<Record<keyof Partial<S>, ModeType>> =
    {};
  protected accessor _ruleName: Partial<
    Record<keyof Partial<S>, RuleNameType>
  > = {};
  protected accessor _logicType: Partial<Record<keyof Partial<S>, LogicType>> =
    {};
  public setSearchData = (searchData: Partial<S> = {}) => {
    this._searchData = {
      ...this._initSearchData,
      ...searchData,
      ...this._staticSearchData,
    };

    this._query.toF(
      this._searchData,
      this._modeType as Partial<Record<keyof S, ModeType>>,
      this._ruleName,
      this._logicType
    );

    // The total count is fetched only on search; paging/sorting does not re-request it
    this.getTotal();

    this.changePage({ num: 1 });
  };
  public initSearchData = (searchData?: Partial<S>) => {
    this._restorePageSize();

    if (searchData) {
      this._initSearchData = searchData;
    }

    if (!this._order) {
      this._order = this._initOrder;
    }
    if (this._order) {
      this._query.toOArr([this._order]);
    }

    queueMicrotask(() => {
      this.setSearchData(this._initSearchData);
    });
  };

  /**
   * Pagination
   */
  @computed
  get page() {
    return this._page;
  }
  @observable
  protected accessor _page: { num: number; size: number } = {
    num: 1,
    size: 20,
  };

  /**
   * 每页条数的缓存键：按页面路径隔离，**惰性取值**。
   *
   * 不能在字段初始化时读 window.location.pathname——store 的构造时机是它所在模块
   * 首次被 import 的那一刻，未必是本页处于激活状态的时候（单例 store 尤其如此），
   * 那时读到的可能是别的页面的路径，于是这一页去读/写了别人的每页条数。
   * 这里等到真正发生翻页动作时再取，那时本页一定是当前页。
   */
  private accessor _pageSizeKey: string | undefined = undefined;
  private _cacheKey = () => {
    if (this._pageSizeKey === undefined) {
      this._pageSizeKey = window.location.pathname;
    }
    return this._pageSizeKey;
  };

  /** 从缓存恢复本页的每页条数，入口初始化时调用一次 */
  private _restorePageSize = () => {
    const size = wsCache.get(CACHE_KEY.PAGE_SIZE)?.[this._cacheKey()];
    if (size) {
      this._page = { ...this._page, size };
    }
  };
  protected accessor _c: 1 | 0 = 0;
  public changePage = (
    page: { num?: number; size?: number },
    search: boolean = true
  ) => {
    if (!search) {
      this._page = { ...this._page, ...page };

      return;
    }

    this._isLoading = true;
    // Clear the old list before the request to avoid showing stale rows until new data returns
    this._dataSource = [];

    this._page = { ...this._page, ...page };

    wsCache.set(CACHE_KEY.PAGE_SIZE, {
      ...(wsCache.get(CACHE_KEY.PAGE_SIZE) || {}),
      [this._cacheKey()]: this._page.size,
    });

    this._query.toP(this._page.num, this._page.size, this._c);

    this.getDataSource();
  };
  public resetPage = () => {
    this.changePage({ num: 1 });
  };
  public onShowSizeChange = (page: { num?: number; size?: number }) => {
    this._page = { ...this._page, ...page };
  };

  /**
   * List
   */
  @computed
  get total() {
    return this._total;
  }
  @observable
  protected accessor _total: number = 0;

  /**
   * Total count loading
   * true while an independent total-count request (getTotal) is in flight; maintained by subclasses that have an independent total-count request
   */
  @computed
  get totalLoading() {
    return this._totalLoading;
  }
  @observable
  protected accessor _totalLoading: boolean = false;
  @computed
  get dataSource(): Array<D> {
    return this._dataSource;
  }
  @observable
  protected accessor _dataSource: Array<D> = [];
  public getDataSource = () => {
    // Concrete data fetch logic is implemented by subclasses
  };

  /**
   * Partially update a single row (merge in place by primary key) without triggering a full table refresh
   * @param id primary key value
   * @param row fields to merge
   * @param key primary key field name, default "id"
   */
  protected _patchRow = (
    id: number | string,
    row: Partial<D>,
    key: string = "id"
  ) => {
    const index = this._dataSource.findIndex(
      (item) => String((item as Record<string, unknown>)[key]) === String(id)
    );

    if (index > -1) {
      this._dataSource[index] = { ...this._dataSource[index], ...row };
    }
  };

  // Sequence number for single-row refresh requests, used to discard stale out-of-order responses
  private accessor _rowRefreshSeq: Map<string, number> = new Map();

  /**
   * Re-fetch a single row by primary key and merge it in place, without triggering a full table refresh
   * Uses the list API so the row structure matches the list; falls back to a full table refresh if the row is not found
   * @param id primary key
   * @param fetchList list API (the same one used by getDataSource)
   * @param key primary key field name, default "id"
   */
  protected _refreshRowData = (
    id: number | string,
    fetchList: (params: { query: string }) => Promise<ResType<ListRes<D>>>,
    key: string = "id"
  ) => {
    const seq = (this._rowRefreshSeq.get(String(id)) ?? 0) + 1;
    this._rowRefreshSeq.set(String(id), seq);

    const query = new Query();
    query.toEqual(key, id);
    query.toP(1, 1, 1);

    fetchList({ query: query.value })
      .then((res) => {
        if (this._rowRefreshSeq.get(String(id)) !== seq) {
          return;
        }

        const row = res.code === 0 ? res.data.list?.[0] : undefined;

        if (row) {
          this._patchRow(id, row, key);
        } else {
          this.getDataSource();
        }
      })
      .catch(() => {});
  };

  /**
   * Get the total count
   * Called only on search (setSearchData); paging/sorting does not trigger it
   * Implemented by subclasses that have an independent total-count request; lists without one need not override it
   */
  public getTotal = () => {
    // Concrete total-count fetch logic is implemented by subclasses
  };

  /**
   * Delete
   * @param id
   */
  public delData = (_id: number | string) => {
    // Concrete delete logic is implemented by subclasses
  };

  /**
   * Import a file
   * @param file
   */
  public uploadList = (_file: FormData) => {
    // Concrete import logic is implemented by subclasses
  };

  /**
   * Message handling
   * @param res
   */
  protected _message = (res?: ResType) => {
    if (res?.code === 0) {
      if (typeof res?.data === "string") {
        notification.success({
          title: res.data,
        });
      } else {
        message.success(res?.msg ?? "成功");
      }
    } else {
      notification.error({
        title: res?.msg ?? "失败",
      });
    }
  };

  /**
   * Reset the store
   */
  public resetStore = () => {
    this._searchData = {};
    this._order = undefined;
    this._page = {
      num: 1,
      size: wsCache.get(CACHE_KEY.PAGE_SIZE)?.[this._cacheKey()] || 20,
    };
    this._dataSource = [];
    this._total = 0;
    this._totalLoading = false;
    this._isLoading = true;
    this._rowRefreshSeq.clear();
    this._query.clear();

    this.resetFormData();

    this._resetStore();
  };
  protected _resetStore = () => {};
}
