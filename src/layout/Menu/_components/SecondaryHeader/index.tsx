import React, { ReactNode } from "react";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";

import styles from "./index.module.scss";

export interface SecondaryHeaderProps {
  collapsed?: boolean;
  theme?: "light" | "dark";
  /** 返回入口文案，折叠时只剩箭头 */
  backText?: string;
  /** 自定义返回行为；不给就退回浏览器上一页 */
  onBack?: () => void;
  /** 当前实体名（详情页的标题），显示在返回入口下方 */
  title?: string;
  /** 返回入口与标题之间的额外内容，如详情内检索框 */
  extra?: ReactNode;
}

/**
 * 次级菜单的默认头部：返回入口 ＋ 标题，中间留一个 `extra` 插槽。
 *
 * `Menu` 在切到次级菜单时默认渲染它，调用方只需按需给 title/onBack/extra；
 * 整块要换掉时再传 `secondaryHeader` 覆盖；业务侧的头部通常就是在这上面补一两件
 * 自己的东西（检索框之类）。
 */
const SecondaryHeader: React.FC<SecondaryHeaderProps> = (props) => {
  const {
    collapsed = false,
    theme = "dark",
    backText = "返回",
    onBack,
    title,
    extra,
  } = props;
  const navigate = useNavigate();

  return (
    <div className={classNames(styles.SecondaryHeader, styles[theme])}>
      <div
        className={classNames(styles.back, {
          [styles.backCollapsed]: collapsed,
        })}
        onClick={() => (onBack ? onBack() : navigate(-1))}
      >
        <ArrowLeftOutlined />
        {!collapsed && <span className={styles.backText}>{backText}</span>}
      </div>
      {!collapsed && extra}
      {!collapsed && title && (
        <div className={styles.title} title={title}>
          {title}
        </div>
      )}
    </div>
  );
};

export default SecondaryHeader;
