"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_ID = "00000000-0000-0000-0000-000000000010";

interface ChatFriend {
  id: string;
  display_name: string;
  picture_url: string | null;
  chat_messages: {
    content: { text?: string; data?: string } | string;
    created_at: string;
    direction: string;
  }[];
}

interface Message {
  id: string;
  friend_id: string;
  direction: "inbound" | "outbound";
  content: { text?: string; data?: string } | string;
  created_at: string;
  message_type: string;
}

function getContentText(content: { text?: string; data?: string } | string): string {
  if (typeof content === "string") return content;
  return content?.text ?? content?.data ?? "";
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "昨日";
  return `${diffDay}日前`;
}

export default function ChatPage() {
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedFriend = friends.find((f) => f.id === selectedFriendId);

  // Fetch friends with latest message
  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    const { data, error } = await supabase
      .from("friends")
      .select(
        "id, display_name, picture_url, chat_messages(content, created_at, direction)"
      )
      .eq("channel_id", CHANNEL_ID)
      .order("created_at", {
        referencedTable: "chat_messages",
        ascending: false,
      })
      .limit(1, { referencedTable: "chat_messages" });

    if (error) {
      console.error("Error fetching friends:", error);
    }

    // Filter to only friends that have messages, then sort by latest message
    const friendsWithMessages = ((data as ChatFriend[]) ?? [])
      .filter((f) => f.chat_messages && f.chat_messages.length > 0)
      .sort((a, b) => {
        const aTime = a.chat_messages[0]?.created_at ?? "";
        const bTime = b.chat_messages[0]?.created_at ?? "";
        return bTime.localeCompare(aTime);
      });

    setFriends(friendsWithMessages);
    setLoadingFriends(false);
  }, []);

  // Fetch messages for selected friend
  const fetchMessages = useCallback(async (friendId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("friend_id", friendId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
    }

    setMessages((data as Message[]) ?? []);
    setLoadingMessages(false);

    // Mark inbound messages as read
    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("friend_id", friendId)
      .eq("direction", "inbound")
      .is("read_at", null);
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    if (selectedFriendId) {
      fetchMessages(selectedFriendId);
    }
  }, [selectedFriendId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to realtime updates on chat_messages
  useEffect(() => {
    const channel = supabase
      .channel("chat_messages_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;

          // If the new message belongs to the selected friend, add it
          if (selectedFriendId && newMsg.friend_id === selectedFriendId) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Mark as read if inbound
            if (newMsg.direction === "inbound") {
              supabase
                .from("chat_messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", newMsg.id)
                .then();
            }
          }

          // Refresh friends list to update preview
          fetchFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedFriendId, fetchFriends]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !selectedFriendId || sending) return;
    const message = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: selectedFriendId, message }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Send error:", err);
        alert("メッセージの送信に失敗しました");
        setInputMessage(message);
      } else {
        // Refresh messages and friends list
        await fetchMessages(selectedFriendId);
        await fetchFriends();
      }
    } catch (err) {
      console.error("Send error:", err);
      alert("メッセージの送信に失敗しました");
      setInputMessage(message);
    }

    setSending(false);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Left panel: chat list */}
      <div
        className={`w-full border-r border-gray-200 sm:w-80 sm:shrink-0 ${
          selectedFriendId ? "hidden sm:block" : ""
        }`}
      >
        <div className="border-b border-gray-200 p-3">
          <input
            type="text"
            placeholder="チャットを検索..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
          />
        </div>
        <ul className="overflow-y-auto" style={{ height: "calc(100% - 52px)" }}>
          {loadingFriends ? (
            [...Array(5)].map((_, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="mt-1 h-3 w-40 animate-pulse rounded bg-gray-200" />
                </div>
              </li>
            ))
          ) : friends.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-400">
              チャット履歴がありません
            </li>
          ) : (
            friends.map((friend) => {
              const lastMsg = friend.chat_messages?.[0];
              return (
                <li key={friend.id}>
                  <button
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      selectedFriendId === friend.id
                        ? "bg-[#06C755]/5"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {friend.picture_url ? (
                      <img
                        src={friend.picture_url}
                        alt={friend.display_name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06C755]/10 text-sm font-bold text-[#06C755]">
                        {friend.display_name?.charAt(0) ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {friend.display_name}
                        </span>
                        {lastMsg && (
                          <span className="text-xs text-gray-400">
                            {timeAgo(lastMsg.created_at)}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="truncate text-xs text-gray-500">
                          {lastMsg.direction === "outbound" ? "あなた: " : ""}
                          {getContentText(lastMsg.content)}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Right panel: chat window */}
      <div
        className={`flex flex-1 flex-col ${
          !selectedFriendId ? "hidden sm:flex" : "flex"
        }`}
      >
        {selectedFriendId && selectedFriend ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <button
                className="sm:hidden"
                onClick={() => setSelectedFriendId(null)}
              >
                <svg
                  className="h-5 w-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              {selectedFriend.picture_url ? (
                <img
                  src={selectedFriend.picture_url}
                  alt={selectedFriend.display_name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#06C755]/10 text-sm font-bold text-[#06C755]">
                  {selectedFriend.display_name?.charAt(0) ?? "?"}
                </div>
              )}
              <span className="font-medium text-gray-900">
                {selectedFriend.display_name}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-gray-400">読み込み中...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-gray-400">メッセージはありません</div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.direction === "outbound" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs rounded-2xl px-4 py-2 text-sm lg:max-w-md ${
                        msg.direction === "outbound"
                          ? "bg-[#06C755] text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p>{getContentText(msg.content)}</p>
                      <p
                        className={`mt-1 text-xs ${
                          msg.direction === "outbound"
                            ? "text-white/70"
                            : "text-gray-400"
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="メッセージを入力..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !inputMessage.trim()}
                  className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "送信中..." : "送信"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-gray-500">友だちを選択してください</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
