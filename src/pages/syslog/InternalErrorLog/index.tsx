import React, { useEffect, useMemo, useState } from "react";

import { ChakraButtonProps, ColumnsType, FormItemProps, Panel, Operate } from "@hsu-react/ui";
import InternalErrorLogStore from "./InternalErrorLogStore";
import { observer } from "mobx-react-lite";
import styles from "./index.module.scss";
import InternalErrorLogForm from "./InternalErrorLogForm";
import CleanInternalErrorLogForm from "./CleanInternalErrorLogForm";
import ChatModal from "../_components/ChatModal";
import ChatModalStore from "../_components/ChatModal/ChatModalStore";
import { RobotOutlined, DeleteOutlined } from "@ant-design/icons";
import OptionsStore, { Options } from "@/stores/OptionsStore";
import { message } from "@hsu-react/ui";
import dayjs from "dayjs";
import { getDateRange } from "hsu-utils";

const InternalErrorLog: React.FC = observer(() => {
  const {
    setSearchData,
    initSearchData,
    dataSource,
    isLoading,
    total,
    changePage,
    page,
    searchData,
    getDataSource,
    order,
    onOrderChange,
  } = InternalErrorLogStore;
  const [id, setId] = useState<number | string>();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cleanOpen, setCleanOpen] = useState<boolean>(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { setInheritedData, newChat } = ChatModalStore;
  const { getLargeModelApiKeyList } = OptionsStore;
  const apiKey = Options("LARGE_MODEL_API_KEY_LIST")?.[0]?.value?.toString();

  const chatSelectedRowsData = useMemo(
    () =>
      dataSource.filter(
        (item) => item.id && selectedRowKeys.includes(item.id),
      ),
    [dataSource, selectedRowKeys],
  );

  useEffect(() => {
    const crtTm = getDateRange({
      amount: 1,
      type: "past",
    });

    initSearchData({
      crtTm,
    });
  }, [initSearchData]);

  useEffect(() => {
    getLargeModelApiKeyList();
  }, [getLargeModelApiKeyList]);

  const searchItems: FormItemProps[] = [
    {
      type: "RANGEPICKER",
      name: "crtTm",
      label: "记录时间",
      initialValue: getDateRange({
        amount: 1,
        type: "past",
      }),
      componentProps: {
        maxDate: dayjs(new Date()),
        allowClear: false,
      },
    },
  ];

  const handleOpenChatModal = () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) {
      message.warning("请先选择要分析的日志记录");
      return;
    }

    if (!apiKey) {
      message.error("未配置 API Key，无法使用 AI 分析功能");
      return;
    }

    // Get the selected records
    const selectedRecords = dataSource.filter(
      (item) => item.id && selectedRowKeys.includes(item.id),
    );

    // Set the inherited data
    const ids = selectedRecords?.map((record) => record.id);

    const inheritedData: Record<string, unknown> = {
      cd: "errorInner",
      ids,
    };

    const crtTm = searchData?.crtTm;
    if (crtTm && Array.isArray(crtTm) && crtTm.length === 2) {
      inheritedData.startTime = crtTm[0];
      inheritedData.endTime = crtTm[1];
    }

    // Set the inherited data and open the dialog
    newChat();
    setInheritedData(inheritedData);
    setChatModalOpen(true);
  };

  const beforeButtonGroup: ChakraButtonProps[] = [
    {
      title: "AI分析",
      colorPalette: "blue",
      icon: <RobotOutlined />,
      onClick: handleOpenChatModal,
      disabled: !selectedRowKeys || selectedRowKeys.length === 0,
      hasPermi: ["ai:dify:add"],
    },
    {
      title: "清理日志",
      colorPalette: "red",
      icon: <DeleteOutlined />,
      onClick: () => {
        setCleanOpen(true);
      },
      hasPermi: ["sys:log:clean"],
    },
  ];

  const columns: ColumnsType = [
    {
      title: "方法",
      dataIndex: "method",
      width: 120,
    },
    {
      title: "请求参数",
      dataIndex: "regArg",
      width: 200,
    },
    {
      title: "失败信息",
      dataIndex: "errInfo",
      width: 200,
    },
    {
      title: "创建时间",
      dataIndex: "crtTm",
      width: 160,
      align: "center",
      fixedWidth: true,
    },
    {
      title: "操作",
      width: 80,
      ellipsis: false,
      align: "center",
      fixed: "right",
      fixedWidth: true,
      render: (record) => (
        <Operate
          menu={[
            {
              title: "详情",
              onClick: () => {
                setId(record.id);
                setOpen(true);
              },
              hasPermi: ["sys:logErrorInner:info"],
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Panel.List
        className={styles.InternalErrorLog}
        searchProps={{
          searchItems,
          onSearch: setSearchData,
          onReset: initSearchData,
          beforeButtonGroup,
          hasPermi: ["sys:logErrorInner:query"],
        }}
        tableProps={{
          columns,
          dataSource,
          rowKey: "id",
          loading: isLoading,
          rowSelection: {
            preserveSelectedRowKeys: true,
            selectedRowKeys,
            onChange: (keys) => {
              setSelectedRowKeys(keys);
            },
          },
          pagination: {
            total,
            onChange: (num, size) => changePage({ num, size }),
            current: page?.num,
            pageSize: page?.size,
            simple: true,
          },
          order,
          onOrderChange,
        }}
      />
      <InternalErrorLogForm
        open={open}
        title={title}
        id={id}
        mode={title ? "edit" : "detail"}
        onCancel={() => {
          setId("");
          setOpen(false);
          setTitle("");
        }}
        onOk={() => {
          getDataSource();
        }}
      />
      <CleanInternalErrorLogForm
        open={cleanOpen}
        onCancel={() => {
          setCleanOpen(false);
        }}
        onOk={() => {
          getDataSource();
        }}
      />
      {apiKey && (
        <ChatModal
          open={chatModalOpen}
          apiKey={apiKey}
          listTitle="内部错误日志"
          tableColumns={columns}
          selectedRowsData={chatSelectedRowsData}
          onCancel={() => {
            setChatModalOpen(false);
            setSelectedRowKeys([]);
          }}
        />
      )}
    </>
  );
});

export default InternalErrorLog;
