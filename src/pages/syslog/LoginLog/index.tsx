import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import dayjs from "dayjs";
import { getDateRange } from "hsu-utils";

import { ColumnsType, FormItemProps, Panel, Operate, ChakraButtonProps } from "@hsu-react/ui";
import OptionsStore, { Options } from "@/stores/OptionsStore";

import LoginLogStore from "./LoginLogStore";
import LoginLogForm from "./LoginLogForm";
import CleanLoginLogForm from "./CleanLoginLogForm";
import ChatModal from "../_components/ChatModal";
import ChatModalStore from "../_components/ChatModal/ChatModalStore";
import styles from "./index.module.scss";
import { DeleteOutlined, RobotOutlined } from "@ant-design/icons";
import { message } from "@hsu-react/ui";

const LoginLog: React.FC = observer(() => {
  const {
    setSearchData,
    initSearchData,
    dataSource,
    isLoading,
    page,
    changePage,
    total,
    searchData,
    order,
    onOrderChange,
    getDataSource,
  } = LoginLogStore;
  const { getLoginLogStatus, getLargeModelApiKeyList } = OptionsStore;
  const [open, setOpen] = useState<boolean>(false);
  const [id, setId] = useState<string>("");
  const [cleanOpen, setCleanOpen] = useState<boolean>(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { setInheritedData, newChat } = ChatModalStore;
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

    getLoginLogStatus();
    getLargeModelApiKeyList();
  }, [getLoginLogStatus, initSearchData, getLargeModelApiKeyList]);

  const searchItems: FormItemProps[] = [
    { type: "INPUT", name: "username", label: "用户名" },
    { type: "INPUT", name: "ip", label: "IP" },
    {
      type: "SELECT",
      name: "status",
      label: "状态",
      componentProps: {
        options: Options("LOGIN_LOG_STATUS"),
      },
    },
    {
      type: "RANGEPICKER",
      name: "crtTm",
      label: "创建时间",
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

  const columns: ColumnsType = [
    { title: "用户名", dataIndex: "username", width: 150, fixedWidth: true },
    {
      title: "IP",
      dataIndex: "ip",
      width: 150,
      align: "center",
    },
    {
      title: "类型",
      dataIndex: "typeDsr",
      orderKey: "type",
      align: "center",
      width: 150,
    },
    {
      title: "状态",
      dataIndex: "statusDsr",
      orderKey: "status",
      align: "center",
      width: 150,
    },
    {
      title: "创建时间",
      dataIndex: "crtTm",
      align: "center",
      width: 160,
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
              hasPermi: ["sys:logLogin:info"],
            },
          ]}
        />
      ),
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
    const crtTm = searchData.crtTm;

    const inheritedData: Record<string, unknown> = {
      cd: "loginLog",
      ids,
    };

    // If there is a time range, set startTime and endTime
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

  return (
    <>
      <Panel.List
        className={styles.LoginLog}
        searchProps={{
          searchItems,
          onSearch: setSearchData,
          onReset: initSearchData,
          beforeButtonGroup,
          hasPermi: ["sys:logLogin:query"],
          columnOffsetWidth: 10,
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
            onChange: (num, size) => changePage({ num, size }),
            pageSize: page?.size,
            current: page?.num,
            total,
            simple: true,
          },
          order,
          onOrderChange,
        }}
      />
      <LoginLogForm
        open={open}
        id={id}
        date={searchData.crtTm}
        onCancel={() => {
          setOpen(false);
          setId("");
        }}
      />
      <CleanLoginLogForm
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
          listTitle="登录日志"
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

export default LoginLog;
