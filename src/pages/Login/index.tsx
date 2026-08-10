// antd's Form is used only as a plain container here (hsu-ui's Form exposes
// Modal/Drawer/Import/useForm, not a container); Button comes from hsu-ui
import { Divider, Form, Segmented } from "antd";
import { message } from "@hsu-react/ui";
import {
  DingtalkOutlined,
  LockOutlined,
  SmileOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { Button, FormItem } from "@hsu-react/ui";
import LoginStore from "./LoginStore";
import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import styles from "./index.module.scss";
import { useDebounceEffect } from "ahooks";
import { useNavigate } from "react-router-dom";

const DEFAULT_PATH = process.env.DEFAULT_PATH ?? "/";
const DINGTALK_STATE_KEY = "dingtalk_oauth_state";

type Mode = "login" | "register";

const Login: React.FC = observer(() => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [mode, setMode] = useState<Mode>("login");
  const [submitting, setSubmitting] = useState(false);
  const [dingtalkEnabled, setDingtalkEnabled] = useState(false);
  const {
    login,
    register,
    captchaImg,
    getCaptchaImg,
    checkIsNeedLoginCaptcha,
    isNeedLoginCaptcha,
    getCryptoKey,
    gotoDingtalk,
    checkDingtalkEnabled,
    dingtalkLogin,
  } = LoginStore;

  useDebounceEffect(() => {
    getCryptoKey();

    checkIsNeedLoginCaptcha();
  }, [checkIsNeedLoginCaptcha, getCryptoKey]);

  // DingTalk: probe the toggle (hide the entry if not configured) + handle the QR-scan callback
  // The probe request carries skipAuthRedirect; a 401 is silently treated as disabled, without redirecting to login
  useEffect(() => {
    checkDingtalkEnabled().then(setDingtalkEnabled);

    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("authCode");
    if (!authCode) return;
    const state = params.get("state") ?? undefined;
    const saved = sessionStorage.getItem(DINGTALK_STATE_KEY);
    // Clear the callback params from the address bar to avoid re-triggering on refresh
    window.history.replaceState({}, "", window.location.pathname);
    if (saved && state && saved !== state) {
      message.error("钉钉登录校验失败，请重试");
      return;
    }
    sessionStorage.removeItem(DINGTALK_STATE_KEY);
    setSubmitting(true);
    dingtalkLogin(authCode, state, () => {
      message.success("登录成功");
      navigate(DEFAULT_PATH);
    }).finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDingtalk = () => {
    const state = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(DINGTALK_STATE_KEY, state);
    gotoDingtalk(state).then((ok) => {
      if (!ok) message.error("钉钉登录暂不可用");
    });
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    form.resetFields();
  };

  const onLogin = () => {
    form.validateFields().then((values) => {
      setSubmitting(true);
      login(values, () => {
        navigate(DEFAULT_PATH);
      }).finally(() => setSubmitting(false));
    });
  };

  const onRegister = () => {
    form.validateFields().then((values) => {
      if (values.password !== values.confirmPassword) {
        message.error("两次输入的密码不一致");
        return;
      }
      setSubmitting(true);
      register(
        {
          username: values.username,
          password: values.password,
          nickname: values.nickname,
          codeVal: values.codeVal,
        },
        () => {
          message.success("注册成功，已自动登录");
          navigate(DEFAULT_PATH);
        },
      ).finally(() => setSubmitting(false));
    });
  };

  const submit = mode === "login" ? onLogin : onRegister;

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.login}>
      <div className={styles.brand}>
        <div className={styles.brandInner}>
          <div className={styles.brandLogo}>{Config.title?.[0] ?? "AI"}</div>
          <div className={styles.brandTitle}>{Config.title ?? "AI 平台"}</div>
          <div className={styles.brandSlogan}>
            智能问答 · 智能体生态 · 企业级 AI 能力中台
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              {mode === "login" ? "欢迎回来" : "创建账号"}
            </div>
            <div className={styles.cardSub}>
              {mode === "login"
                ? "登录以继续使用平台"
                : "几秒钟即可完成注册"}
            </div>
          </div>

          <Segmented
            block
            className={styles.tabs}
            value={mode}
            onChange={(v) => switchMode(v as Mode)}
            options={[
              { label: "登录", value: "login" },
              { label: "注册", value: "register" },
            ]}
          />

          <Form form={form} className={styles.form}>
            <FormItem
              type="INPUT"
              name="username"
              className={styles.formitem}
              required
              requiredMsg="请输入用户名"
              inputHeight={52}
              componentProps={{
                placeholder: "请输入用户名",
                prefix: <UserOutlined />,
                className: styles.input,
                onKeyDown: onEnter,
              }}
            />

            {mode === "register" && (
              <FormItem
                type="INPUT"
                name="nickname"
                className={styles.formitem}
                inputHeight={52}
                componentProps={{
                  placeholder: "请输入昵称（选填）",
                  prefix: <SmileOutlined />,
                  className: styles.input,
                  onKeyDown: onEnter,
                }}
              />
            )}

            <FormItem
              type="PASSWORD"
              name="password"
              className={styles.formitem}
              required
              requiredMsg="请输入密码"
              inputHeight={52}
              componentProps={{
                placeholder: mode === "register" ? "请设置密码（6~30 位）" : "请输入密码",
                prefix: <LockOutlined />,
                className: styles.input,
                onKeyDown: onEnter,
              }}
            />

            {mode === "register" && (
              <FormItem
                type="PASSWORD"
                name="confirmPassword"
                className={styles.formitem}
                required
                requiredMsg="请再次输入密码"
                inputHeight={52}
                componentProps={{
                  placeholder: "请再次输入密码",
                  prefix: <LockOutlined />,
                  className: styles.input,
                  onKeyDown: onEnter,
                }}
              />
            )}

            <FormItem
              type="INPUT"
              name="codeVal"
              className={styles.formitem}
              required
              requiredMsg="请输入验证码"
              inputHeight={52}
              componentProps={{
                placeholder: "请输入验证码",
                suffix: (
                  <img
                    className={styles.captcha}
                    src={captchaImg}
                    onClick={getCaptchaImg}
                  />
                ),
                className: styles.input,
                onKeyDown: onEnter,
              }}
              visible={isNeedLoginCaptcha}
            />
          </Form>

          <Button
            type="primary"
            className={styles.button}
            loading={submitting}
            onClick={submit}
          >
            {mode === "login" ? "登 录" : "注 册"}
          </Button>

          <div className={styles.switchTip}>
            {mode === "login" ? (
              <>
                还没有账号？
                <a onClick={() => switchMode("register")}>立即注册</a>
              </>
            ) : (
              <>
                已有账号？
                <a onClick={() => switchMode("login")}>返回登录</a>
              </>
            )}
          </div>

          {dingtalkEnabled && (
            <>
              <Divider className={styles.otherDivider} plain>
                其他登录方式
              </Divider>
              <div className={styles.otherLogin}>
                <button
                  type="button"
                  className={styles.dingtalkBtn}
                  onClick={onDingtalk}
                  title="钉钉扫码登录"
                >
                  <DingtalkOutlined />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default Login;
