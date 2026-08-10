import { ResType } from "@/services/Axios";
import { message, notification } from "@hsu-react/ui";
import { computed, makeObservable, observable } from "mobx";

/**
 * F: form data type
 */
class FormModalStore<F = Record<string, unknown>> {
  constructor() {
    makeObservable(this);
  }

  /**
   * Form data
   */
  @computed
  get formData(): Partial<F> {
    return this._formData;
  }
  @observable
  protected accessor _formData: Partial<F> = {};

  /**
   * Form type
   */
  @computed
  get formType(): string {
    return this._formType;
  }
  @observable
  protected accessor _formType: string = "def";
  public setFormType = (formType: string) => {
    this._formType = formType;
  };

  /**
   * Detail request sequence: invalidates stale delayed callbacks after
   * resetFormData, preventing a previous form's data from filling the current one.
   */
  private _formSeq = 0;

  /**
   * Get the detail
   * @param id
   */
  public getFormData = (id: number | string, data?: Partial<F>) => {
    const seq = ++this._formSeq;
    setTimeout(() => {
      // Bail out if the form was reset or reopened during the delay,
      // otherwise the old callback would overwrite the current form.
      if (seq !== this._formSeq) {
        return;
      }
      this._getFormData(id, data);
    }, 500);
  };
  protected _getFormData = (_id: number | string, _data?: Partial<F>) => {
    // Concrete fetch logic is implemented by subclasses
  };

  /**
   * Edit
   * @param data
   */
  public editFormData = (
    _id: number | string,
    _data: Partial<F>,
    fn?: () => void
  ) => {
    // Concrete edit logic is implemented by subclasses
    fn?.();
  };

  /**
   * Create
   * @param data
   */
  public addFormData = (_data: Partial<F>, fn?: () => void) => {
    // Concrete create logic is implemented by subclasses
    fn?.();
  };

  /**
   * Reset the form data
   */
  public resetFormData = () => {
    // Bump the sequence so any in-flight delayed getFormData is discarded
    this._formSeq++;
    this._formData = {};
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
    this._formData = {};

    this._resetStore();
  };

  protected _resetStore = () => {};
}

export default FormModalStore;
