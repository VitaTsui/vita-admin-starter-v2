import { setToken, setUserInfo } from "@/utils/auth";

import {
  getCryptoKey,
  login,
  LoginData,
  register,
  RegisterData,
  isNeedLoginCaptcha,
  logout,
  getDingtalkUrl,
  dingtalkLogin,
} from "@/services/apis/login";
import crypto from "@/utils/crypto";
import { getUUID } from "@/utils";
import { makeAutoObservable } from "mobx";

import RouterService from "@/router/RouterService";
import { notification } from "@hsu-react/ui";
import Cookies from "js-cookie";

const dev = process.env.NODE_ENV === "development";
const apiBase = process.env.API_BASE;

class LoginStore {
  get captchaImg() {
    return this._captchaImg;
  }
  private _captchaImg: string = "";

  get isNeedLoginCaptcha() {
    return this._isNeedLoginCaptcha;
  }
  private _isNeedLoginCaptcha: boolean = false;

  private _codeKey: string = "";

  private _cryptoKey: string = "";

  constructor() {
    makeAutoObservable(this);
  }

  public getCryptoKey = async () => {
    const res = await getCryptoKey();
    if (res.code === 0) {
      this._cryptoKey = res.data;
    }
  };

  // Check whether a login captcha is required
  public checkIsNeedLoginCaptcha = async () => {
    try {
      const res = await isNeedLoginCaptcha();
      if (res.code === 0) {
        this._isNeedLoginCaptcha = res.data;
        if (this._isNeedLoginCaptcha) {
          this.getCaptchaImg();
        }
      }
    } catch {
      void 0;
    }
  };

  public login = async (
    data: Omit<LoginData, "cryptoKey" | "codeKey">,
    fn?: () => void,
  ) => {
    const key = await crypto.decrypt(this._cryptoKey);
    const username = await crypto.encodeRSA(
      await crypto.encrypt(data.username, key),
    );
    const password = await crypto.encodeRSA(
      await crypto.encrypt(data.password, key),
    );

    const form: LoginData = {
      ...data,
      cryptoKey: this._cryptoKey,
      username,
      password,
      codeKey: this._codeKey,
    };

    const res = await login(form);
    if (res.code === 0) {
      const data = res.data;

      setToken(data.token);
      setUserInfo(data.userInfo);
      Cookies.set("tenant-id", "0");

      await RouterService.getMenuList(true);

      await RouterService.getPermissions(true);

      fn?.();
    } else {
      notification.error({
        title: res?.msg ?? "失败",
      });

      this.checkIsNeedLoginCaptcha();
    }
  };

  public register = async (
    data: { username: string; password: string; nickname?: string } & Pick<
      LoginData,
      "codeVal"
    >,
    fn?: () => void,
  ) => {
    const key = await crypto.decrypt(this._cryptoKey);
    const username = await crypto.encodeRSA(
      await crypto.encrypt(data.username, key),
    );
    const password = await crypto.encodeRSA(
      await crypto.encrypt(data.password, key),
    );

    const form: RegisterData = {
      cryptoKey: this._cryptoKey,
      username,
      password,
      nickname: data.nickname,
      codeKey: this._codeKey,
      codeVal: data.codeVal,
    };

    const res = await register(form);
    if (res.code === 0) {
      const resData = res.data;

      setToken(resData.token);
      setUserInfo(resData.userInfo);
      Cookies.set("tenant-id", "0");

      await RouterService.getMenuList(true);
      await RouterService.getPermissions(true);

      fn?.();
    } else {
      notification.error({
        title: res?.msg ?? "注册失败",
      });

      this.checkIsNeedLoginCaptcha();
    }
  };

  // Fetch the DingTalk QR authorization URL and redirect; returns false when disabled so the page hides the entry
  public gotoDingtalk = async (state: string): Promise<boolean> => {
    const res = await getDingtalkUrl(state);
    if (res.code === 0 && res.data?.enabled && res.data.url) {
      window.location.href = res.data.url;
      return true;
    }
    return false;
  };

  // Detect whether DingTalk is enabled (controls visibility of the login page entry)
  public checkDingtalkEnabled = async (): Promise<boolean> => {
    try {
      const res = await getDingtalkUrl("");
      return res.code === 0 && !!res.data?.enabled;
    } catch {
      return false;
    }
  };

  // Exchange the DingTalk callback auth code for a login session
  public dingtalkLogin = async (
    authCode: string,
    state: string | undefined,
    fn?: () => void,
  ) => {
    const res = await dingtalkLogin({ authCode, state });
    if (res.code === 0) {
      const data = res.data;
      setToken(data.token);
      setUserInfo(data.userInfo);
      Cookies.set("tenant-id", "0");

      await RouterService.getMenuList(true);
      await RouterService.getPermissions(true);

      fn?.();
    } else {
      notification.error({
        title: res?.msg ?? "钉钉登录失败",
      });
    }
  };

  public getCaptchaImg = () => {
    this._codeKey = getUUID();
    this._captchaImg = `${dev ? (apiBase ?? "/api") : ""}/auth/kaptcha/generate/${
      this._codeKey
    }`;
    this._isNeedLoginCaptcha = true;
  };

  public logout = (fn?: () => void) => {
    logout()
      .then((res) => {
        if (res.code === 0) {
          fn?.();
        } else {
          notification.error({
            title: res.msg,
          });
        }
      })
      // Still run fn on a network failure (clear cookies + go to /login): the
      // server-side session expires anyway, and stranding the user on a page where
      // "log out" does nothing is worse. The forced re-login after a password
      // change goes through here too.
      .catch(() => {
        notification.warning({
          title: "退出登录请求失败，已在本地清除登录状态",
        });
        fn?.();
      });
  };
}

export default new LoginStore();
