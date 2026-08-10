import React, { useEffect, useState } from "react";
import { Modal, Spin, Tree } from "antd";
import { message } from "@hsu-react/ui";
import type { DataNode } from "antd/es/tree";

import {
  DeptData,
  getDingtalkOrgTree,
  importDingtalkOrg,
} from "@/services/apis/permit/dept";

interface DingtalkSyncModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
}

// Convert the DingTalk dept tree (DeptData) into antd Tree nodes
const toTreeData = (list: DeptData[]): DataNode[] =>
  list.map((item) => ({
    key: String(item.id),
    title: item.nm,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));

const DingtalkSyncModal: React.FC<DingtalkSyncModalProps> = (props) => {
  const { open, onCancel, onOk } = props;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (!open) return;
    setCheckedKeys([]);
    setLoading(true);
    getDingtalkOrgTree()
      .then((res) => {
        if (res.code === 0) {
          setTreeData(toTreeData(res.data ?? []));
        } else {
          message.error(res.msg || "获取钉钉组织失败");
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const onImport = () => {
    if (!checkedKeys.length) {
      message.warning("请至少选择一个部门");
      return;
    }
    setSubmitting(true);
    importDingtalkOrg(checkedKeys.map(String))
      .then((res) => {
        if (res.code === 0) {
          message.success(`已同步 ${res.data ?? 0} 个部门`);
          onOk();
        } else {
          message.error(res.msg || "同步失败");
        }
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Modal
      title="同步钉钉组织"
      open={open}
      onCancel={onCancel}
      onOk={onImport}
      okText="导入选中部门"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <div style={{ maxHeight: 420, overflow: "auto", minHeight: 120 }}>
          {treeData.length ? (
            <Tree
              checkable
              defaultExpandAll
              treeData={treeData}
              checkedKeys={checkedKeys}
              onCheck={(keys) =>
                setCheckedKeys(Array.isArray(keys) ? keys : keys.checked)
              }
            />
          ) : (
            !loading && (
              <div style={{ color: "#8a94a6", textAlign: "center" }}>
                暂无可同步的钉钉部门
              </div>
            )
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default DingtalkSyncModal;
