import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import dayjs from "dayjs";
import { getDateRange } from "hsu-utils";

import { ColumnsType, FormItemProps, Panel, Operate, ChakraButtonProps } from "@hsu-react/ui";
import OprLogStore from "./OprLogStore";
import styles from "./index.module.scss";
import OprLogForm from "./OprLogForm";
import CleanOprLogForm from "./CleanOprLogForm";
import ChatModal from "../_components/ChatModal";
import ChatModalStore from "../_components/ChatModal/ChatModalStore";
import { DeleteOutlined, RobotOutlined } from "@ant-design/icons";
import OptionsStore, { Options } from "@/stores/OptionsStore";
import { message } from "@hsu-react/ui";

const OprLog: React.FC = observer(() => {
  const {
    setSearchData,
    initSearchData,
    dataSource,
    isLoading,
    total,
    changePage,
    page,
    searchData,
    order,
    onOrderChange,
    getDataSource,
  } = OprLogStore;
  const { getLargeModelApiKeyList } = OptionsStore;
  const [id, setId] = useState<number | string>();
  const [open, setOpen] = useState(false);
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
    getLargeModelApiKeyList();
  }, [initSearchData, getLargeModelApiKeyList]);

  const searchItems: FormItemProps[] = [
    {
      type: "INPUT",
      name: "userNm__busNm",
      label: "关键字",
      componentProps: {
        placeholder: "操作人名称、业务名称",
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
    {
      title: "ID",
      dataIndex: "id",
      width: 180,
      align: "center",
      fixedWidth: true,
    },
    {
      title: "操作人名称",
      dataIndex: "userNm",
      width: 120,
    },
    {
      title: "业务名称",
      dataIndex: "busNm",
      width: 120,
    },
    {
      title: "业务类型",
      dataIndex: "busTypeDsr",
      orderKey: "busType",
      width: 120,
      align: "center",
    },
    {
      title: "操作内容",
      dataIndex: "cont",
      width: 500,
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
              hasPermi: ["sys:oprLog:info"],
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
    const crtTm = searchData?.crtTm;

    const inheritedData: Record<string, unknown> = {
      cd: "operationLog",
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
        className={styles.OprLog}
        searchProps={{
          searchItems,
          onSearch: setSearchData,
          onReset: initSearchData,
          beforeButtonGroup,
          hasPermi: ["sys:oprLog:query"],
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
      <OprLogForm
        open={open}
        title="详情"
        id={id}
        onCancel={() => {
          setId("");
          setOpen(false);
        }}
      />
      <CleanOprLogForm
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
          listTitle="操作日志"
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

export default OprLog;
