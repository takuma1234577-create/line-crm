"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

// Claude API file limits
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_CSV_TYPES = ["text/csv", "application/vnd.ms-excel"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES, ...ACCEPTED_CSV_TYPES];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_SIZE = 32 * 1024 * 1024; // 32MB
const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: FileAttachment[];
}

interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

const quickActions = [
  { label: "今日のメッセージ", icon: "inbox", message: "今日の未読メッセージをまとめて" },
  { label: "今日のサマリー", icon: "chart", message: "今日の状況をまとめて" },
  { label: "一斉配信", icon: "broadcast", message: "メッセージを一斉配信したい" },
  { label: "AI返信ON/OFF", icon: "toggle", message: "AI自動返信の状態を確認して" },
  { label: "ステップ配信作成", icon: "steps", message: "新しいステップ配信を作りたい" },
  { label: "自動応答作成", icon: "reply", message: "新しい自動応答ルールを作りたい" },
];

const suggestedPrompts = [
  "今日の未読メッセージを確認して",
  "新規友だちにウェルカムメッセージを送りたい",
  "最近のAI返信の精度を分析して",
  "キャンペーン配信を企画して",
];

const welcomeMessage: ChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "こんにちは！LINE CRM AIアシスタントです。\n\n友だち管理、メッセージ配信、データ分析など、CRMの操作をお手伝いします。\n\n- 上のボタンからよく使う操作をすぐに実行できます\n- 自然な日本語で何でも指示してください\n- 例: 「今日の未読メッセージをまとめて返信して」",
};

function QuickActionIcon({ name }: { name: string }) {
  const cn = "h-4 w-4";
  switch (name) {
    case "inbox":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
        </svg>
      );
    case "chart":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      );
    case "broadcast":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
        </svg>
      );
    case "toggle":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
    case "steps":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
        </svg>
      );
    case "reply":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Extract suggested action buttons from AI response text.
 * Detects patterns like:
 * - Yes/No questions: いかがですか？/ よろしいですか？/ しますか？
 * - Lettered options: A) ..., B) ..., C) ...
 * - Numbered options with descriptions
 */
function extractSuggestedActions(text: string): { label: string; message: string }[] {
  const actions: { label: string; message: string }[] = []
  const lines = text.split("\n").map((l) => l.trim())

  // Detect yes/no confirmation questions
  const confirmPatterns = [
    /いかがですか？/,
    /よろしいですか？/,
    /しますか？/,
    /しましょうか？/,
    /実行しますか？/,
    /送信していいですか？/,
    /どうですか？$/,
    /いいですか？/,
  ]
  const lastLines = lines.slice(-5).join(" ")
  const hasConfirmQuestion = confirmPatterns.some((p) => p.test(lastLines))

  if (hasConfirmQuestion) {
    actions.push(
      { label: "はい、お願いします", message: "はい、お願いします" },
      { label: "いいえ、やめておきます", message: "いいえ、やめておきます" },
    )
  }

  // Detect lettered options: A) ..., B) ..., or A. ..., B. ...
  const letterOptionRegex = /^([A-Z])[)\.]\s*(.+)/
  for (const line of lines) {
    const match = line.match(letterOptionRegex)
    if (match) {
      const label = match[2].replace(/\*\*/g, "").trim()
      // Truncate long labels
      const shortLabel = label.length > 30 ? label.slice(0, 30) + "…" : label
      actions.push({ label: `${match[1]}) ${shortLabel}`, message: `${match[1]}でお願いします` })
    }
  }

  // Detect numbered options: 1. ..., 2. ..., or 1) ..., 2) ...
  if (actions.length === 0 || hasConfirmQuestion) {
    const numberOptionRegex = /^(\d+)[)\.]\s*\**(.+?)\**\s*[—\-:：]/
    for (const line of lines) {
      const match = line.match(numberOptionRegex)
      if (match) {
        const num = match[1]
        const label = match[2].replace(/\*\*/g, "").trim()
        const shortLabel = label.length > 25 ? label.slice(0, 25) + "…" : label
        actions.push({ label: shortLabel, message: `${num}番の「${label}」でお願いします` })
      }
    }
  }

  // Deduplicate by message
  const seen = new Set<string>()
  return actions.filter((a) => {
    if (seen.has(a.message)) return false
    seen.add(a.message)
    return true
  })
}

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="my-2 ml-4 list-disc space-y-1 text-sm">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (str: string, key: string): React.ReactNode => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return str;
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </span>
    );
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <p key={`h-${i}`} className="mt-3 mb-1.5 text-sm font-bold text-gray-900">
          {renderInline(trimmed.slice(4), `hi-${i}`)}
        </p>
      );
    } else if (trimmed.startsWith("- ")) {
      listItems.push(
        <li key={`li-${i}`} className="text-gray-700">{renderInline(trimmed.slice(2), `lii-${i}`)}</li>
      );
    } else if (trimmed === "") {
      flushList();
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      flushList();
      elements.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-gray-700">
          {renderInline(trimmed, `pi-${i}`)}
        </p>
      );
    }
  });
  flushList();
  return elements;
}

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      const isCSVByExt = file.name.toLowerCase().endsWith(".csv");
      if (!ACCEPTED_TYPES.includes(file.type) && !isCSVByExt) {
        alert(`非対応のファイル形式です: ${file.name}\n対応形式: JPEG, PNG, GIF, WebP, PDF, CSV`);
        continue;
      }

      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isCSV = ACCEPTED_CSV_TYPES.includes(file.type) || isCSVByExt;
      const maxSize = isImage ? MAX_IMAGE_SIZE : isCSV ? MAX_CSV_SIZE : MAX_PDF_SIZE;
      const maxLabel = isImage ? "5MB" : isCSV ? "10MB" : "32MB";

      if (file.size > maxSize) {
        alert(`ファイルサイズが上限を超えています: ${file.name}\n上限: ${maxLabel}`);
        continue;
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

      setAttachments((prev) => [
        ...prev,
        {
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
          previewUrl,
        },
      ]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const messageText = (messageOverride ?? input).trim();
    if ((!messageText && attachments.length === 0) || isLoading) return;

    const currentAttachments = [...attachments];

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText || (currentAttachments.length > 0 ? `${currentAttachments.length}個のファイルを送信` : ""),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!messageOverride) setInput("");
    setAttachments([]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId: conversationId ?? undefined,
          channelId: CHANNEL_ID,
          attachments: currentAttachments.map((a) => ({
            type: a.type,
            name: a.name,
            base64: a.base64,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantText = "";
      const assistantId = `assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.type === "conversation_id") {
              setConversationId(data.id);
            } else if (data.type === "text") {
              assistantText += data.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: assistantText }
                    : msg
                )
              );
            } else if (data.type === "done") {
              // Stream complete
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (buffer.trim().startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.type === "text") {
            assistantText += data.text;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: assistantText }
                  : msg
              )
            );
          }
        } catch {
          // Skip
        }
      }
    } catch (err) {
      console.error("AI chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "申し訳ありません。エラーが発生しました。もう一度お試しください。",
        },
      ]);
    }

    setIsLoading(false);
  }, [input, isLoading, conversationId, attachments]);

  const handleQuickAction = (message: string) => {
    setInput("");
    handleSend(message);
  };

  const startNewConversation = () => {
    setMessages([welcomeMessage]);
    setConversationId(null);
    setInput("");
  };

  const isEmptyState = messages.length === 1 && messages[0].id === "assistant-welcome";

  return (
    <div
      className="relative flex h-full bg-[#F7F8FA]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#06C755]/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#06C755] bg-white/90 px-12 py-10 shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#06C755]/10">
              <svg className="h-8 w-8 text-[#06C755]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900">ファイルをドロップ</p>
            <p className="text-sm text-gray-500">画像（5MB以下）・PDF（32MB以下）・CSV（10MB以下）</p>
          </div>
        </div>
      )}

      {/* Conversation History Sidebar - Hidden on mobile */}
      <div
        className={`hidden border-r border-gray-200 bg-white transition-all duration-200 lg:block ${
          showSidebar ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900">会話履歴</h2>
            <button
              onClick={startNewConversation}
              className="rounded-lg bg-[#06C755] p-2 text-white transition-colors hover:bg-[#05A649]"
              title="新しい会話"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="mt-3 text-sm text-gray-500">まだ会話がありません</p>
                <p className="mt-1 text-xs text-gray-400">AIに質問を送信してください</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full rounded-lg p-3 text-left transition-colors hover:bg-gray-50"
                >
                  <p className="truncate text-sm font-medium text-gray-900">{conv.title}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{conv.lastMessage}</p>
                  <p className="mt-1 text-xs text-gray-400">{conv.timestamp}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Quick Actions Bar */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Toggle sidebar button */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 lg:block"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Quick action buttons */}
            <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.message)}
                  disabled={isLoading}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:border-[#06C755] hover:bg-[#06C755]/5 hover:text-[#06C755] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <QuickActionIcon name={action.icon} />
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg, msgIndex) => {
              if (msg.role === "system") return null;

              const isUser = msg.role === "user";
              const isLastAssistantMsg =
                !isUser &&
                msg.content &&
                !isLoading &&
                msgIndex === messages.length - 1;
              const suggestedActions = isLastAssistantMsg
                ? extractSuggestedActions(msg.content)
                : [];

              return (
                <div key={msg.id}>
                  <div
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""} max-w-[85%]`}>
                      {/* Avatar */}
                      {!isUser && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#06C755] to-[#05A649] shadow-sm">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                          </svg>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          isUser
                            ? "bg-[#06C755] text-white shadow-sm"
                            : "bg-white text-gray-800 shadow-sm border border-gray-100"
                        }`}
                      >
                        {/* Attachment previews */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {msg.attachments.map((att) =>
                              att.previewUrl ? (
                                <img
                                  key={att.id}
                                  src={att.previewUrl}
                                  alt={att.name}
                                  className="max-h-48 max-w-full rounded-lg object-contain"
                                />
                              ) : (
                                <div
                                  key={att.id}
                                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                                    isUser ? "bg-white/20" : "bg-gray-100"
                                  }`}
                                >
                                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                  </svg>
                                  <span className="truncate max-w-[120px]">{att.name}</span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                        {isUser ? (
                          msg.content ? <p className="whitespace-pre-wrap text-sm">{msg.content}</p> : null
                        ) : msg.content ? (
                          <div className="space-y-1">{renderFormattedText(msg.content)}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Suggested action buttons */}
                  {suggestedActions.length > 0 && (
                    <div className="mt-3 ml-13 flex flex-wrap gap-2 pl-[52px]">
                      {suggestedActions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(action.message)}
                          disabled={isLoading}
                          className="rounded-full border border-[#06C755]/30 bg-[#06C755]/5 px-4 py-2 text-sm font-medium text-[#06C755] transition-all hover:border-[#06C755] hover:bg-[#06C755]/10 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#06C755] to-[#05A649] shadow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Suggested prompts for empty state */}
            {isEmptyState && (
              <div className="mt-8">
                <p className="mb-3 text-center text-sm text-gray-500">または、こちらの質問を試してみてください</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleQuickAction(prompt)}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-all hover:border-[#06C755] hover:bg-[#06C755]/5 hover:text-[#06C755]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
          <div className="mx-auto max-w-3xl">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="group relative flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    {att.previewUrl ? (
                      <img src={att.previewUrl} alt={att.name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-red-50">
                        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-700 max-w-[120px]">{att.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {att.size < 1024 * 1024
                          ? `${(att.size / 1024).toFixed(0)}KB`
                          : `${(att.size / (1024 * 1024)).toFixed(1)}MB`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3">
              {/* File upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="ファイルを添付（画像: 5MB以下, PDF: 32MB以下, CSV: 10MB以下）"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={[...ACCEPTED_TYPES, ".csv"].join(",")}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="AIに指示を入力... 画像やPDFも添付できます"
                  rows={1}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm leading-relaxed placeholder:text-gray-400 focus:border-[#06C755] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isLoading}
                />
                <div className="absolute bottom-2.5 right-2.5 hidden items-center gap-1 text-xs text-gray-400 sm:flex">
                  <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                  <span>で送信</span>
                </div>
              </div>
              <button
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#06C755] text-white shadow-sm transition-all hover:bg-[#05A649] hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
