"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

const quickActions = [
  { label: "今日のメッセージ", emoji: "\uD83D\uDCE8", message: "今日の未読メッセージをまとめて" },
  { label: "今日のサマリー", emoji: "\uD83D\uDCCA", message: "今日の状況をまとめて" },
  { label: "一斉配信", emoji: "\uD83D\uDCE2", message: "メッセージを一斉配信したい" },
  { label: "AI返信ON/OFF", emoji: "\uD83E\uDD16", message: "AI自動返信の状態を確認して" },
  { label: "ステップ配信作成", emoji: "\uD83D\uDCDD", message: "新しいステップ配信を作りたい" },
  { label: "自動応答作成", emoji: "\uD83D\uDCAC", message: "新しい自動応答ルールを作りたい" },
];

const welcomeMessage: ChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "こんにちは！LINE CRM AIアシスタントです。\n\n友だち管理、メッセージ配信、データ分析など、CRMの操作をお手伝いします。\n\n- 上のボタンからよく使う操作をすぐに実行できます\n- 自然な日本語で何でも指示してください\n- 例: 「今日の未読メッセージをまとめて返信して」",
};

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="my-1.5 ml-4 list-disc space-y-0.5 text-[13px]">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (str: string, key: string): React.ReactNode => {
    // Bold **text**
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
        <p key={`h-${i}`} className="mt-2 mb-1 text-sm font-bold text-gray-900">
          {renderInline(trimmed.slice(4), `hi-${i}`)}
        </p>
      );
    } else if (trimmed.startsWith("- ")) {
      listItems.push(
        <li key={`li-${i}`}>{renderInline(trimmed.slice(2), `lii-${i}`)}</li>
      );
    } else if (trimmed === "") {
      flushList();
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      flushList();
      elements.push(
        <p key={`p-${i}`} className="text-[13px] leading-relaxed">
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const messageText = (messageOverride ?? input).trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!messageOverride) setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId: conversationId ?? undefined,
          channelId: CHANNEL_ID,
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

      // Process remaining buffer
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
  }, [input, isLoading, conversationId]);

  const handleQuickAction = (message: string) => {
    setInput("");
    handleSend(message);
  };

  const handleReply = (friendName: string) => {
    setInput(`${friendName}さんに返信: `);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Quick Actions */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.message)}
              disabled={isLoading}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition-all hover:border-[#06C755] hover:bg-[#06C755]/5 hover:text-[#06C755] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{action.emoji}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => {
            if (msg.role === "system") return null;

            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""} max-w-[85%]`}>
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#06C755] mt-0.5">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      isUser
                        ? "bg-[#06C755] text-white"
                        : "bg-white text-gray-800 shadow-sm border border-gray-100"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
                    ) : (
                      <div className="space-y-0.5">{renderFormattedText(msg.content)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#06C755]">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex gap-1.5 items-center">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AIに指示を入力... 例: 今日のメッセージをまとめて返信して"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm leading-relaxed placeholder:text-gray-400 focus:border-[#06C755] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#06C755] transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#06C755] text-white transition-all hover:bg-[#05a649] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
