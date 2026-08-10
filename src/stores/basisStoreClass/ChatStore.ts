import { computed, makeObservable, observable } from "mobx";
import { ResType, streamRequest } from "@/services/Axios";
import { UploadFile } from "antd";
import { notification } from "@hsu-react/ui";
import { deepCopy, generateRandomStr, getTimeDifference } from "hsu-utils";
import dayjs from "dayjs";
import {
  AnswerMessage,
  ChatHistoryData,
  ChatMessage,
  RetrieverResource,
} from "@hsu-react/ui";
import { routerHistory } from "@hsu-react/single-router";

// Constant definitions
const NEW_CHAT_ID = "NEW_CHAT";
const END_THINK_FLAG = "[ENDTHINKFLAG]";
const REDACTED_REASONING_START = "<think>";
const REDACTED_REASONING_END = "</think>";
const HISTORY_GROUP_TODAY = "今天";
const HISTORY_GROUP_YESTERDAY = "昨天";
const HISTORY_GROUP_WITHIN_7_DAYS = "7 天内";
const HISTORY_GROUP_WITHIN_30_DAYS = "30 天内";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;

export interface AgentConfig {
  key: string;
  open: boolean;
}

interface ChatConfig {
  model: string;
  agents: AgentConfig[];
  hasThinking?: boolean;
}

interface StreamMessageData {
  conversationId?: string;
  taskId?: string;
  messageId?: string;
  event: string;
  answer?: string;
  metadata?: {
    retrieverResources?: RetrieverResource[];
  };
  message?: string;
}

export interface ChatDetailData {
  id: string;
  conversation_id: string;
  parent_message_id: null;
  inputs: Record<string, unknown>;
  query: string;
  answer: string;
  feedback: {
    rating?: "like" | "dislike";
  };
  retrieverResources: RetrieverResource[];
  created_at: number;
  messageFiles: {
    id: string;
    nm: string;
    filename: string;
    type: string;
    url: string;
    mime_type: string;
    size: number;
    transfer_method: string;
    belongs_to: string;
  }[];
  status: string;
  error: null;
  messageId: string;
  conversationId: string;
  crtTm: string;
  queryTm: string;
}

export interface ChatListData {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  status: string;
  crtTm: number;
  updTm: number;
  sortTm: number;
  ago: number;
  conversationId: string;
}

/**
 * Base chat store class
 */
class ChatStore {
  // Streaming request API URL
  protected accessor _streamApiUrl = "";

  // Message list
  @computed
  get messages() {
    return this._messages;
  }
  @observable
  protected accessor _messages = new Map<string, ChatMessage[]>();

  // Whether a conversation is in progress
  @computed
  get assistanting() {
    return this._assistanting;
  }
  @observable
  protected accessor _assistanting = new Map<string, boolean>();

  // File list
  @computed
  get fileList() {
    return this._fileList;
  }
  @observable
  protected accessor _fileList = new Map<string, UploadFile[]>();

  // Current model
  @computed
  get currentModel() {
    return this._currentModel;
  }
  @observable
  protected accessor _currentModel = new Map<string, string>();

  // Feature key (agent) states
  @computed
  get agentsState() {
    return this._agentsState;
  }
  @observable
  protected accessor _agentsState = new Map<string, AgentConfig[]>();

  // History conversation list
  @computed
  get historyList() {
    return this._historyList;
  }
  @observable
  protected accessor _historyList: Record<string, ChatHistoryData[]> = {};

  // Current app key
  @computed
  get currentApiKey() {
    return this._currentApiKey;
  }
  @observable
  protected accessor _currentApiKey = "";

  // Current chat ID
  @computed
  get currentChatId() {
    return this._currentChatId;
  }
  @observable
  protected accessor _currentChatId = NEW_CHAT_ID;

  @observable
  protected accessor _abortController = new Map<
    string,
    AbortController | null
  >();
  @observable
  protected accessor _taskId = new Map<string, string>();

  // Search data
  @computed
  get historySearchData() {
    return this._historySearchData;
  }
  @observable
  protected accessor _historySearchData: Record<string, string | number> = {};

  constructor() {
    makeObservable(this);
  }

  /**
   * Clear all data for the given chatId
   */
  protected _clearChatData = (chatId: string) => {
    this._messages.delete(chatId);
    this._assistanting.delete(chatId);
    this._fileList.delete(chatId);
    this._abortController.delete(chatId);
    this._taskId.delete(chatId);
    this._currentModel.delete(chatId);
    this._agentsState.delete(chatId);
  };

  /**
   * Create a new chat
   */
  public newChat = () => {
    this._currentChatId = NEW_CHAT_ID;
    this._clearChatData(NEW_CHAT_ID);
  };

  /**
   * Set the current model
   */
  public setCurrentModel = (model: string) => {
    this._currentModel.set(this._currentChatId, model);
  };

  /**
   * Set feature key (agent) states
   */
  public setAgentsState = (agents: AgentConfig[]) => {
    this._agentsState.set(this._currentChatId, agents);
  };

  /**
   * Set the current chat ID
   */
  public setCurrentChatId = (chatId: string) => {
    if (this._currentChatId !== chatId) {
      this._currentChatId = chatId;
    }
  };

  /**
   * Set the file list
   */
  public setFileList = (fileList: UploadFile[]) => {
    this._fileList.set(this._currentChatId, fileList);
  };

  /**
   * Set the current app key
   */
  public setCurrentApiKey = (apiKey: string) => {
    this._currentApiKey = apiKey;
  };

  /**
   * Get the chat config
   */
  protected _getChatConfig = (
    chatId: string,
    model?: string,
    agentsState?: AgentConfig[],
    hasThinking?: boolean
  ): ChatConfig => {
    return {
      model: this._currentModel.get(chatId) || model || "",
      agents: this._agentsState.get(chatId) || agentsState || [],
      hasThinking,
    };
  };

  /**
   * Handle thinking content
   */
  protected _handleThinkContent = (
    answer: AnswerMessage,
    data: StreamMessageData,
    thinkStart: Date | null
  ) => {
    if (!data.answer) return;

    let processedAnswer = data.answer;
    if (processedAnswer === END_THINK_FLAG) {
      processedAnswer = REDACTED_REASONING_END;
    }

    if (processedAnswer === REDACTED_REASONING_END && thinkStart) {
      const { seconds, milliseconds } = getTimeDifference(
        thinkStart.toISOString(),
        new Date().toISOString()
      );
      answer.think_time = seconds + Number((milliseconds / 1000).toFixed(2));
    }

    if (answer.think === "") {
      answer.think = processedAnswer.startsWith(REDACTED_REASONING_START)
        ? processedAnswer
        : `${REDACTED_REASONING_START}${processedAnswer}`;
    } else {
      if (processedAnswer.includes(REDACTED_REASONING_END)) {
        answer.think +=
          processedAnswer.split(REDACTED_REASONING_END)[0] +
          REDACTED_REASONING_END;
        answer.answer = processedAnswer.split(REDACTED_REASONING_END)[1];
      } else {
        answer.think += processedAnswer;
      }
    }
  };

  /**
   * Handle migration to a new chat ID
   */
  protected _handleNewChatMigration = (
    newChatId: string,
    config: ChatConfig
  ) => {
    this._clearChatData(NEW_CHAT_ID);
    this._currentChatId = newChatId;
    this._assistanting.set(newChatId, true);
    this._currentModel.set(newChatId, config.model);
    this._agentsState.set(newChatId, config.agents);
    this.getHistoryList();
    routerHistory.push(`/${newChatId}`);
  };

  /**
   * Handle stream messages
   */
  protected _handleStreamMessage = (
    data: StreamMessageData,
    currentChatId: string,
    chat: ChatMessage[],
    config: ChatConfig,
    thinkStart: Date | null,
    abortController: AbortController
  ): string => {
    let chatId = currentChatId;

    // Handle new chat ID migration
    if (chatId === NEW_CHAT_ID && data.conversationId) {
      this._handleNewChatMigration(data.conversationId, config);
      chatId = data.conversationId;
    }

    // Set the task ID
    if (data.taskId) {
      this._taskId.set(chatId, data.taskId);
    }

    // Register the new stream request
    if (!this._abortController.has(chatId)) {
      this._abortController.set(chatId, abortController);
    }

    // Get the current chat
    const currentChat = chat.length
      ? chat
      : [...(this._messages.get(chatId) || [])];

    // Update the message ID
    const query = currentChat[currentChat.length - 1]?.query;
    if (query && data.messageId) {
      query.messageId = data.messageId;
    }

    // Handle the answer
    const answer = currentChat[currentChat.length - 1]?.answers[0];
    if (
      answer &&
      (data.event === "agent_message" ||
        data.event === "agent_thought" ||
        data.event === "message")
    ) {
      if (data.messageId) {
        answer.messageId = data.messageId;
      }

      // Only handle thinking content when the model supports thinking
      const shouldHandleThinking = config.hasThinking !== false;

      if (data.event === "agent_thought") {
        if (shouldHandleThinking) {
          this._handleThinkContent(answer, data, thinkStart);
        }
      }

      if (data.event === "agent_message" && data.answer) {
        answer.answer += data.answer;
      }

      if (data.event === "message") {
        if (
          shouldHandleThinking &&
          !answer.think?.endsWith(REDACTED_REASONING_END)
        ) {
          this._handleThinkContent(answer, data, thinkStart);
        } else {
          if (answer.answer) {
            answer.answer += data.answer;
          } else {
            answer.answer = data.answer;
          }
        }
      }
    }

    // End the conversation
    if (data.event === "message_end") {
      if (answer) {
        if (data.metadata) {
          answer.retrieverResources = data.metadata.retrieverResources;
        }

        answer.time = dayjs().format("YYYY-MM-DD HH:mm:ss");
      }

      this._assistanting.set(chatId, false);
    }

    // Error handling
    if (data.event.includes("error")) {
      if (answer) {
        answer.error = data.message || "";
      }

      this._assistanting.set(chatId, false);
      this._abortController.delete(chatId);
    }

    // Update the chat
    this._messages.set(chatId, currentChat);

    return chatId;
  };

  /**
   * Create a new message object
   */
  protected _createNewMessage = (
    content: string,
    files: UploadFile[],
    messageId: string
  ): ChatMessage => {
    return {
      query: {
        query: content,
        messageFiles: files?.map((file) => ({
          filename: file.name,
          url: file.url || "",
          id: file.response?.id || "",
        })),
        messageId,
        time: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      },
      answers: [
        {
          think_time: 0,
          think: "",
          answer: "",
          retrieverResources: [],
          messageId,
          like: null,
          time: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        },
      ],
    };
  };

  /**
   * Format file data for API requests
   */
  protected _formatFilesForApi = (files: UploadFile[]) => {
    return files.length
      ? files?.map((file) => ({
          type: "document",
          transferMethod: "local_file",
          uploadFileId: file.response?.id || "",
        }))
      : undefined;
  };

  /**
   * Handle stream request errors and closing
   */
  protected _handleStreamEnd = (chatId: string) => {
    this._assistanting.set(chatId, false);
    this._abortController.delete(chatId);
    this.getHistoryList();
  };

  /**
   * Start a chat
   */
  public chat = ({
    apiKey,
    content,
    again,
    model,
    agentsState,
    hasThinking,
  }: {
    apiKey: string;
    content: string;
    again?: boolean;
    model?: string;
    agentsState?: AgentConfig[];
    hasThinking?: boolean;
  }) => {
    this._currentApiKey = apiKey;

    const files = deepCopy(this._fileList.get(this._currentChatId) || []);
    this._fileList.delete(this._currentChatId);

    let currentChatId = this._currentChatId;
    let thinkStart: Date | null = null;

    const config = this._getChatConfig(
      currentChatId,
      model,
      agentsState,
      hasThinking
    );
    const messageId = generateRandomStr(16);

    // Get the current chat
    let chat = [...(this._messages.get(currentChatId) || [])];

    // If resending, remove the last message
    if (again && chat.length > 1) {
      chat = chat.slice(0, chat.length - 1);
    }

    // Add a new message (if not resending)
    if (!again) {
      chat.push(this._createNewMessage(content, files, messageId));
    }

    // Set the chat and state
    this._messages.set(currentChatId, chat);
    this._assistanting.set(currentChatId, true);

    // Initiate the stream request
    const abortController = streamRequest(this._streamApiUrl, {
      data: {
        content,
        apiKey,
        files: this._formatFilesForApi(files),
        conversationId: currentChatId === NEW_CHAT_ID ? "" : currentChatId,
        inputs: {
          ...config.agents.reduce((acc, item) => {
            acc[item.key as keyof typeof acc] = `${+item.open}`;
            return acc;
          }, {} as Record<string, string>),
          model: config.model,
        },
      },
      onopen: async () => {
        thinkStart = new Date();
      },
      onmessage: (messages) => {
        try {
          const data: StreamMessageData = JSON.parse(messages.data);
          currentChatId = this._handleStreamMessage(
            data,
            currentChatId,
            chat,
            config,
            thinkStart,
            abortController
          );
        } catch (error) {
          // Set the error message on the answer
          const currentChat = this._messages.get(currentChatId) || chat;
          const answer = currentChat[currentChat.length - 1]?.answers[0];
          if (answer) {
            answer.error =
              error instanceof Error ? error.message : String(error);
            this._messages.set(currentChatId, currentChat);
          }
          this._handleStreamEnd(currentChatId);
        }
      },
      onerror: (error) => {
        // Set the error message on the answer
        const currentChat = this._messages.get(currentChatId) || chat;
        const answer = currentChat[currentChat.length - 1]?.answers[0];
        if (answer) {
          answer.error = error instanceof Error ? error.message : String(error);
          this._messages.set(currentChatId, currentChat);
        }
        this._handleStreamEnd(currentChatId);
      },
      onclose: () => {
        this._handleStreamEnd(currentChatId);
      },
    });
  };

  /**
   * Stop the chat
   */
  public stop = () => {
    const chatId = this._currentChatId;
    const taskId = this._taskId.get(chatId);
    const abortController = this._abortController.get(chatId);

    if (taskId && abortController) {
      this._stopChat({
        taskId,
        apiKey: this._currentApiKey,
      });
    }

    abortController?.abort();
    this._abortController.delete(chatId);
    this._assistanting.set(chatId, false);
    this.getHistoryList();
  };

  /**
   * Stop chat API (to be implemented by subclasses)
   */
  protected _stopChat = (_params: { taskId: string; apiKey: string }) => {
    void _params;
  };

  /**
   * Parse the answer content, separating the thinking part from the answer part
   */
  protected _parseAnswerContent = (answer: string) => {
    const processedAnswer = answer.replace(
      END_THINK_FLAG,
      REDACTED_REASONING_END
    );

    if (processedAnswer.includes(REDACTED_REASONING_END)) {
      let think = processedAnswer.split(REDACTED_REASONING_END)[0];
      if (!think.startsWith(REDACTED_REASONING_START)) {
        think = `${REDACTED_REASONING_START}${think}`;
      }
      think += REDACTED_REASONING_END;

      const answerText = processedAnswer.split(REDACTED_REASONING_END)[1] || "";
      return { think, answer: answerText };
    }

    return { think: "", answer: processedAnswer };
  };

  /**
   * Transform chat detail data into message format
   */
  protected _transformChatDetailToMessage = (
    item: ChatDetailData
  ): ChatMessage => {
    const { think, answer } = this._parseAnswerContent(item.answer);
    const like =
      item.feedback?.rating === "like"
        ? true
        : item.feedback?.rating === "dislike"
        ? false
        : null;

    return {
      query: {
        query: item.query,
        messageFiles: (item?.messageFiles || [])?.map((file) => ({
          filename: window.decodeURIComponent(file.filename || file.nm),
          url: file.url?.startsWith("http") ? file.url : "",
          id: file.id,
        })),
        messageId: item.messageId,
        time: item.queryTm,
      },
      answers: [
        {
          answer,
          think_time: 0,
          think,
          retrieverResources: item.retrieverResources || [],
          messageId: item.messageId,
          like,
          time: item.queryTm,
        },
      ],
    };
  };

  /**
   * Get chat detail
   */
  public getChatDetail = (chatId: string, apiKey?: string) => {
    if (this._currentChatId !== chatId) {
      this._currentChatId = chatId;
    }

    if (this._assistanting.get(chatId) === true) {
      return;
    }

    this._getChatDetailApi({
      apiKey: apiKey || this._currentApiKey,
      conversationId: chatId,
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    })
      .then((res) => {
        const { list } = res.data;

        const messages: ChatMessage[] =
          list?.map((item) => this._transformChatDetailToMessage(item)) || [];

        // Save config info
        const lastItem = list?.[list.length - 1];
        if (lastItem?.inputs) {
          this._currentModel.set(chatId, lastItem.inputs.model as string);
          const agents: AgentConfig[] = Object.keys(lastItem.inputs)?.map(
            (key) => ({
              key,
              open:
                lastItem.inputs[key as keyof typeof lastItem.inputs] === "1",
            })
          );
          this._agentsState.set(chatId, agents);
        }

        this._messages.set(chatId, messages);
      })
      .catch(() => {
        this._message({ code: 500, msg: "获取对话详情失败" } as ResType);
      });
  };

  /**
   * Get chat detail API (to be implemented by subclasses)
   */
  protected _getChatDetailApi = (_params: {
    apiKey: string;
    conversationId: string;
    page: number;
    pageSize: number;
  }): Promise<{ data: { list: ChatDetailData[] } }> => {
    void _params;
    return Promise.resolve({ data: { list: [] } });
  };

  /**
   * Message feedback
   */
  public messageFeedback = (
    messageId: string,
    rating: boolean | null,
    content: string
  ) => {
    this._messageFeedbackApi({
      apiKey: this._currentApiKey,
      messageId,
      rating: rating === null ? "UNLIKE" : rating ? "LIKE" : "DISLIKE",
      content,
    });
  };

  /**
   * Message feedback API (to be implemented by subclasses)
   */
  protected _messageFeedbackApi = (_params: {
    apiKey: string;
    messageId: string;
    rating: "LIKE" | "DISLIKE" | "UNLIKE";
    content: string;
  }) => {
    void _params;
  };

  /**
   * Clear the history conversation list
   */
  public clearHistoryList = () => {
    this._historyList = {};
  };

  /**
   * Get the conversation list
   */
  public getHistoryList = async (
    searchData?: Record<string, string | number>
  ) => {
    if (searchData) {
      this._historySearchData = searchData;
    }

    try {
      const res = await this._getChatListApi({
        apiKey: this._currentApiKey,
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      const { list } = res.data;
      this._historyList = this._formatHistoryList(list);
    } catch {
      this._message({ code: 500, msg: "获取对话列表失败" } as ResType);
    }
  };

  /**
   * Get conversation list API (to be implemented by subclasses)
   */
  protected _getChatListApi = (_params: {
    apiKey: string;
    page: number;
    pageSize: number;
  }): Promise<{ data: { list: ChatListData[] } }> => {
    void _params;
    return Promise.resolve({ data: { list: [] } });
  };

  /**
   * Get the group key for a history record
   */
  protected _getHistoryGroupKey = (ago: number): string => {
    if (ago > 30) {
      return dayjs().format("YYYY-MM");
    }
    if (ago === 0) {
      return HISTORY_GROUP_TODAY;
    }
    if (ago === 1) {
      return HISTORY_GROUP_YESTERDAY;
    }
    if (ago <= 7) {
      return HISTORY_GROUP_WITHIN_7_DAYS;
    }
    return HISTORY_GROUP_WITHIN_30_DAYS;
  };

  /**
   * Add a history record to a group
   */
  protected _addToHistoryGroup = (
    groups: Record<string, ChatHistoryData[]>,
    item: ChatHistoryData,
    groupKey: string
  ) => {
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  };

  /**
   * Format the history conversation list
   */
  protected _formatHistoryList = (
    data: ChatListData[]
  ): Record<string, ChatHistoryData[]> => {
    // Add time-difference info and sort
    const historyList: ChatHistoryData[] = data?.map((item) => ({
      ...item,
      ago: getTimeDifference(
        dayjs(item.sortTm).format("YYYY-MM-DD"),
        dayjs().format("YYYY-MM-DD")
      ).days,
    }));

    // Group by time
    const groupedHistory: Record<string, ChatHistoryData[]> = {};

    historyList?.forEach((item) => {
      const ago = item.ago as number;
      let groupKey: string;

      if (ago > 30) {
        // Group by month when older than 30 days
        groupKey = dayjs(item.updTm as number).format("YYYY-MM");
      } else {
        groupKey = this._getHistoryGroupKey(ago);
      }

      this._addToHistoryGroup(groupedHistory, item, groupKey);
    });

    return groupedHistory;
  };

  /**
   * Update the chat title
   */
  public updateTitle = (chatId: string, title: string) => {
    this._updateTitleApi({
      apiKey: this._currentApiKey,
      conversationId: chatId,
      name: title,
    }).catch(() => {
      this._message({ code: 500, msg: "更新对话标题失败" } as ResType);
    });
  };

  /**
   * Update chat title API (to be implemented by subclasses)
   */
  protected _updateTitleApi = (_params: {
    apiKey: string;
    conversationId: string;
    name: string;
  }): Promise<void> => {
    void _params;
    return Promise.resolve();
  };

  /**
   * Delete a history conversation
   */
  public deleteHistory = (chatId: string, fn?: () => void) => {
    this._deleteChatApi({
      apiKey: this._currentApiKey,
      conversationId: chatId,
    })
      .then(() => {
        this.getHistoryList();
        fn?.();
      })
      .catch(() => {
        this._message({ code: 500, msg: "删除历史会话失败" } as ResType);
      });
  };

  /**
   * Delete history conversation API (to be implemented by subclasses)
   */
  protected _deleteChatApi = (_params: {
    apiKey: string;
    conversationId: string;
  }): Promise<void> => {
    void _params;
    return Promise.resolve();
  };

  /**
   * Message handling
   */
  protected _message = (res?: ResType) => {
    if (res?.code === 200) {
      notification.success({
        title: res?.msg || "成功",
      });
    } else {
      notification.error({
        title: res?.msg || "失败",
      });
    }
  };
}

export default ChatStore;
