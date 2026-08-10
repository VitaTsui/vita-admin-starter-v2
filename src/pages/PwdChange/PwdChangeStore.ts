import { PwdChangeData, editPwdChange } from "@/services/apis/pwdchange";

import FormModalStore from "@/stores/basisStoreClass/FormModalStore";
import { ResType } from "@/services/Axios";
import { makeObservable } from "mobx";
import { notification } from "@hsu-react/ui";

class PwdChangeFormStore extends FormModalStore<PwdChangeData> {
  constructor() {
    super();
    makeObservable(this);
  }

  /**
   * Edit
   * @param id
   * @param data
   * @param fn
   */
  public editFormData = (
    _id: number | string,
    data: PwdChangeData,
    fn?: (res: ResType) => void
  ) => {
    editPwdChange(data)
      .then((res) => {
        if (res.code === 0) {
          fn?.(res);

          notification.success({
            title: "修改成功，请重新登录",
          });
        } else {
          this._message(res);
        }
      })
      // Without this, a network failure leaves the modal silently stuck:
      // no error shown and it never closes.
      .catch(() => {
        notification.error({
          title: "修改密码失败，请检查网络后重试",
        });
      });
  };
}

export default new PwdChangeFormStore();
