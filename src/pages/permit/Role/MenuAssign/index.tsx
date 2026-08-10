import React, { useEffect, useCallback, useMemo } from "react";
import { Key } from "react";
import { Tooltip } from "antd";
import classNames from "classnames";

import { Tree, Checkbox, CheckedKeys, TreeData, Modal, Icon, TextEllipsis } from "@hsu-react/ui";
import MenuAssignStore from "./MenuAssignStore";
import { observer } from "mobx-react-lite";
import styles from "./index.module.scss";

interface MenuAssignProps {
  open?: boolean;
  title?: string;
  id?: string | number;
  roleNm?: string;
  onCancel?: () => void;
  onOk?: () => void;
}

const MENU_TIP =
  "勾选菜单即授权该菜单，并自动勾选其全部功能；点击菜单名称可在右侧单独调整功能；勾选功能会自动勾选所属菜单";
const TOOLTIP_CONFIG = {
  arrow: false,
  placement: "top" as const,
  color: "#f2f4f5",
  // antd v6 把 Tooltip 的语义槽换成了 root / container / arrow，v5 的 body 已不存在
  // （和 Popover 的 .ant-popover-inner -> .ant-popover-container 是同一批改动）
  styles: { container: { color: "#131212", padding: "6px 16px" } },
};

/**
 * Get the keys of all nodes in the tree
 */
const getAllTreeKeys = (nodes: TreeData[]): React.Key[] => {
  const keys: React.Key[] = [];
  nodes?.forEach((node) => {
    keys.push(node.key);
    if (node.children) {
      keys.push(...getAllTreeKeys(node.children));
    }
  });
  return keys;
};

/**
 * Convert CheckedKeys to a string array
 */
const getCheckedKeysArray = (checkedKeys: CheckedKeys): string[] => {
  if (Array.isArray(checkedKeys)) {
    return checkedKeys?.map((key) => key.toString());
  }
  const { checked } = checkedKeys as {
    checked: React.Key[];
    halfChecked: React.Key[];
  };
  return checked?.map((key) => key.toString());
};

const MenuAssign: React.FC<MenuAssignProps> = observer((props) => {
  const { open, id, roleNm, onCancel, onOk } = props;
  const {
    resetFormData,
    resetCheckedKeys,
    getPermRtRscoTreeNode,
    menuTree,
    functionTree,
    menuCheckedKeys,
    functionCheckedKeys,
    selectedMenuKey,
    selectedMenuPath,
    grantSummary,
    setMenuCheckedKeys,
    setFunctionCheckedKeys,
    setSelectedMenuKey,
    getMergedCheckedKeys,
    updateRoleRtRsco,
    checkAllPermissions,
    clearAllPermissions,
  } = MenuAssignStore;

  useEffect(() => {
    if (id && open) {
      getPermRtRscoTreeNode(id);
    }
  }, [getPermRtRscoTreeNode, id, open]);

  const handleClose = useCallback(() => {
    resetFormData();
    resetCheckedKeys();
    onCancel?.();
  }, [resetFormData, resetCheckedKeys, onCancel]);

  const handleOk = useCallback(() => {
    if (!id) return;

    const rscoIdList = getMergedCheckedKeys();
    updateRoleRtRsco(id, { rscoIdList }, () => {
      handleClose();
      onOk?.();
    });
  }, [id, getMergedCheckedKeys, updateRoleRtRsco, handleClose, onOk]);

  const handleMenuChange = useCallback(
    (checkedKeys: CheckedKeys) => {
      setMenuCheckedKeys(checkedKeys);
    },
    [setMenuCheckedKeys]
  );

  const handleMenuSelect = useCallback(
    (selectedKeys: Key[]) => {
      const menuKey = selectedKeys[0]?.toString() ?? null;
      setSelectedMenuKey(menuKey);
    },
    [setSelectedMenuKey]
  );

  const handleFunctionChange = useCallback(
    (checkedKeys: CheckedKeys) => {
      setFunctionCheckedKeys(checkedKeys);
    },
    [setFunctionCheckedKeys]
  );

  // Get the keys of all function nodes
  const allFunctionKeys = useMemo(
    () => getAllTreeKeys(functionTree),
    [functionTree]
  );

  // Compute the select-all state
  const { allChecked, indeterminate } = useMemo(() => {
    if (!allFunctionKeys.length) {
      return { allChecked: false, indeterminate: false };
    }

    const checkedKeys = getCheckedKeysArray(functionCheckedKeys);
    const allFunctionKeysStr = allFunctionKeys?.map((key) => key.toString());
    const checkedCount = allFunctionKeysStr.filter((key) =>
      checkedKeys.includes(key)
    ).length;

    return {
      allChecked: checkedCount === allFunctionKeys.length,
      indeterminate: checkedCount > 0 && checkedCount < allFunctionKeys.length,
    };
  }, [allFunctionKeys, functionCheckedKeys]);

  // Handle select-all
  const handleSelectAll = useCallback(
    (e: { target: { checked: boolean } }) => {
      setFunctionCheckedKeys(e.target.checked ? allFunctionKeys : []);
    },
    [allFunctionKeys, setFunctionCheckedKeys]
  );

  const renderMenuTitle = useCallback((data: TreeData) => {
    const { checked, total } = MenuAssignStore.getMenuGrantInfo(
      String(data.key)
    );

    if (total === 0) {
      return (
        <TextEllipsis containerStyle={{ display: "inline-flex" }}>
          {data.title}
        </TextEllipsis>
      );
    }

    const badgeClassName =
      checked === total
        ? styles.grantAll
        : checked > 0
          ? styles.grantPartial
          : styles.grantNone;

    return (
      <span className={styles.menuTreeNodeRow}>
        <TextEllipsis
          className={styles.menuTreeNodeTitleText}
          containerStyle={{ display: "inline-flex", minWidth: 0, flex: 1 }}
        >
          {data.title}
        </TextEllipsis>
        <Tooltip
          title={`功能已授权 ${checked} / ${total} 项`}
          {...TOOLTIP_CONFIG}
        >
          <span className={classNames(styles.grantBadge, badgeClassName)}>
            {checked}/{total}
          </span>
        </Tooltip>
      </span>
    );
  }, []);

  return (
    <Modal
      className={styles.MenuAssign}
      title={`分配角色权限${roleNm ? ` - ${roleNm}` : ""}`}
      open={open}
      onCancel={handleClose}
      onOk={handleOk}
      width={1200}
      height={700}
      destroyOnClose
    >
      <div className={styles.container}>
        <div className={styles.left}>
          <div className={styles.title}>
            菜单权限
            <Tooltip title={MENU_TIP} {...TOOLTIP_CONFIG}>
              <Icon
                icon="material-symbols:help"
                className={styles.helpIcon}
                fontSize={16}
                color="#999999"
              />
            </Tooltip>
            <span className={styles.summary}>
              已选 {grantSummary.menuCount} 个菜单 ·{" "}
              {grantSummary.functionCount} 个功能
            </span>
          </div>
          <Tree
            search
            treeData={menuTree}
            checkedKeys={menuCheckedKeys}
            selectedKeys={selectedMenuKey ? [selectedMenuKey] : []}
            onChange={handleMenuChange}
            onSelect={handleMenuSelect}
            checkable
            allowDeselect={false}
            defaultExpandLevel={2}
            className={styles.menuTree}
            titleRender={renderMenuTitle}
            buttonGroup={[
              {
                title: "全部授权",
                onClick: checkAllPermissions,
              },
              {
                title: "清空",
                onClick: clearAllPermissions,
              },
            ]}
          />
        </div>
        <div className={styles.right}>
          <div className={styles.title}>
            功能权限
            {selectedMenuPath && (
              <TextEllipsis
                className={styles.menuPath}
                containerStyle={{
                  display: "inline-flex",
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {selectedMenuPath}
              </TextEllipsis>
            )}
            {functionTree.length > 0 && (
              <Checkbox
                checked={allChecked}
                indeterminate={indeterminate}
                onChange={handleSelectAll}
                className={styles.selectAllCheckbox}
              >
                全选
              </Checkbox>
            )}
          </div>
          {functionTree.length > 0 ? (
            <Tree
              key={selectedMenuKey}
              treeData={functionTree}
              checkedKeys={functionCheckedKeys}
              defaultExpandAll
              onChange={handleFunctionChange}
              checkable
              className={styles.functionTree}
              selectable={false}
            />
          ) : (
            <div className={styles.emptyHint}>
              <Icon
                icon="material-symbols:left-click-rounded"
                fontSize={28}
                color="#bfbfbf"
              />
              {selectedMenuKey
                ? "该菜单下暂无功能权限"
                : "点击左侧菜单名称，在此处调整该菜单的功能权限"}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
});

export default MenuAssign;
