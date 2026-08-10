import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Tag } from "antd";
import { CloudSyncOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";

import { ChakraButtonProps, ColumnsType, FormItemProps, Panel, Operate } from "@hsu-react/ui";

import DeptStore from "./DeptStore";
import DeptForm from "./DeptForm";
import DingtalkSyncModal from "./_components/DingtalkSyncModal";
import styles from "./index.module.scss";

const Dept: React.FC = observer(() => {
  const {
    setSearchData,
    initSearchData,
    dataSource,
    isLoading,
    expandedIds,
    delData,
    getDataSource,
    order,
    onOrderChange,
  } = DeptStore;
  const [title, setTitle] = useState<string>("新增");
  const [id, setId] = useState<string>("");
  const [expanded, setExpanded] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [syncOpen, setSyncOpen] = useState<boolean>(false);

  useEffect(() => {
    initSearchData();
  }, [initSearchData]);

  const searchItems: FormItemProps[] = [
    { type: "INPUT", name: "nm", label: "组织名称" },
  ];

  const beforeButtonGroup: ChakraButtonProps[] = [
    {
      title: "新增",
      colorPalette: "blue",
      icon: <PlusOutlined />,
      onClick: () => {
        setTitle("新增");
        setOpen(true);
      },
      hasPermi: ["sys:org:add"],
    },
    {
      title: "同步钉钉组织",
      // 原来写的是 colorPalette="cyan" —— 1.x 的 Button 根本没这个属性，它被透传到
      // DOM 上，只换来一句 React 警告，颜色从未生效。antd v6 起用 color + variant，
      // 且两者必须成对给（只给 color 时 antd 会忽略）
      color: "cyan",
      variant: "outlined",
      icon: <CloudSyncOutlined />,
      onClick: () => {
        setSyncOpen(true);
      },
      hasPermi: ["sys:org:sync"],
    },
    {
      title: "展开/折叠",
      colorPalette: "red",
      icon: <SwapOutlined style={{ transform: "rotate(90deg)" }} />,
      onClick: () => {
        setExpanded(!expanded);
      },
    },
  ];

  const columns: ColumnsType = [
    { title: "组织名称", dataIndex: "nm", width: 200 },
    { title: "编码", dataIndex: "cd", width: 150 },
    {
      title: "排序",
      dataIndex: "seq",
      align: "center",
      width: 80,
      fixedWidth: true,
    },
    {
      title: "来源",
      dataIndex: "source",
      align: "center",
      width: 90,
      fixedWidth: true,
      render: (source) =>
        source === 1 ? (
          <Tag color="cyan">钉钉</Tag>
        ) : (
          <Tag color="default">自建</Tag>
        ),
    },
    {
      title: "操作",
      width: 140,
      ellipsis: false,
      align: "center",
      fixed: "right",
      fixedWidth: true,
      render: (record) => (
        <Operate
          menu={[
            {
              title: "编辑",
              onClick: () => {
                setTitle("修改");
                setOpen(true);
                setId(record.id);
              },
              hasPermi: ["sys:org:upd"],
            },
            {
              title: "删除",
              delete: true,
              onConfirm: () => {
                delData(record.id);
              },
              hasPermi: ["sys:org:del"],
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Panel.List
        className={styles.Dept}
        searchProps={{
          searchItems,
          onSearch: setSearchData,
          onReset: initSearchData,
          beforeButtonGroup,
          hasPermi: ["sys:org:query"],
        }}
        tableProps={{
          columns,
          dataSource,
          rowKey: "id",
          loading: isLoading,
          pagination: false,
          scrollAutoHeight: false,
          expandable: {
            expandedRowKeys: expanded ? expandedIds : undefined,
          },
          serialNumberColumn: false,
          order,
          onOrderChange,
        }}
      />
      <DeptForm
        open={open}
        title={title}
        id={id}
        onCancel={() => {
          setOpen(false);
          setId("");
        }}
        onOk={() => {
          getDataSource();
        }}
      />
      <DingtalkSyncModal
        open={syncOpen}
        onCancel={() => setSyncOpen(false)}
        onOk={() => {
          setSyncOpen(false);
          getDataSource();
        }}
      />
    </>
  );
});

export default Dept;
