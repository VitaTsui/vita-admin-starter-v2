import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import dayjs from "dayjs";
import { getDateRange } from "hsu-utils";

import {
  ColumnsType,
  Form,
  FormItemProps,
  Panel,
  Operate,
  ChakraButtonProps,
} from "@hsu-react/ui";
import OptionsStore, { Options } from "@/stores/OptionsStore";

import JobLogStore from "./JobLogStore";
import JobLogForm from "./JobLogForm";
import CleanJobLogForm from "./CleanJobLogForm";
import ChatModal from "../_components/ChatModal";
import ChatModalStore from "../_components/ChatModal/ChatModalStore";
import styles from "./index.module.scss";
import { DeleteOutlined, RobotOutlined } from "@ant-design/icons";
import { message } from "@hsu-react/ui";
import useSearch from "@/hooks/useSearch";

const JobLog: React.FC = observer(() => {
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
  } = JobLogStore;
  const { getJobLogStatus, getLargeModelApiKeyList } = OptionsStore;
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
  const { status } = useSearch<{ status: string }>();
  const [form] = Form.useForm();

  useEffect(() => {
    const crtTm = getDateRange({
      amount: 1,
      type: "past",
    });

    initSearchData({
      crtTm,
      status: status ? +status : undefined,
    });

    form.setFieldsValue({
      status: status ? +status : undefined,
    });
  }, [initSearchData, status, form]);

  useEffect(() => {
    getJobLogStatus();
    getLargeModelApiKeyList();
  }, [getJobLogStatus, getLargeModelApiKeyList]);

  const searchItems: FormItemProps[] = [
    {
      type: "INPUT",
      name: "nm",
      label: "任务名称",
    },
    {
      type: "SELECT",
      name: "status",
      label: "状态",
      componentProps: {
        options: Options("JOB_LOG_STATUS"),
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
    {
      type: "DATEPICKER",
      name: "execStartTm",
      label: "业务开始时间",
      componentProps: {
        maxDate: dayjs(new Date()),
      },
    },
    {
      type: "DATEPICKER",
      name: "execEndTm",
      label: "业务结束时间",
      componentProps: {
        maxDate: dayjs(new Date()),
      },
    },
  ];

  const columns: ColumnsType = [
    {
      title: "任务编码",
      dataIndex: "cd",
      width: 200,
    },
    {
      title: "任务名称",
      dataIndex: "nm",
      width: 150,
    },
    {
      title: "现在重试次数",
      dataIndex: "currentRetryTimes",
      align: "center",
      width: 120,
      fixedWidth: true,
    },
    {
      title: "最大重试次数",
      dataIndex: "maxRetryTimes",
      align: "center",
      width: 120,
      fixedWidth: true,
    },
    {
      title: "运行时长(ms)",
      dataIndex: "spendTime",
      align: "center",
      width: 120,
      fixedWidth: true,
    },
    {
      title: "状态",
      dataIndex: "statusDsr",
      orderKey: "status",
      align: "center",
      width: 80,
      fixedWidth: true,
    },
    {
      title: "创建时间",
      dataIndex: "crtTm",
      align: "center",
      width: 160,
      fixedWidth: true,
    },
    {
      title: "业务开始时间",
      dataIndex: "execStartTm",
      align: "center",
      width: 160,
      fixedWidth: true,
    },
    {
      title: "业务结束时间",
      dataIndex: "execEndTm",
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
              hasPermi: ["sys:jobLog:info"],
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
      cd: "dispatchLog",
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
        className={styles.JobLog}
        searchProps={{
          externalForm: form,
          searchItems,
          onSearch: setSearchData,
          onReset: initSearchData,
          beforeButtonGroup,
          hasPermi: ["sys:jobLog:query"],
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
      <JobLogForm
        open={open}
        id={id}
        date={searchData.crtTm}
        onCancel={() => {
          setOpen(false);
          setId("");
        }}
      />
      <CleanJobLogForm
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
          listTitle="任务调度日志"
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

export default JobLog;
