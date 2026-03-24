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
    read_at: string | null;
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "今日";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "昨日";
  }
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedFriend = friends.find((f) => f.id === selectedFriendId);

  // Fetch friends with latest message
  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    const { data, error } = await supabase
      .from("friends")
      .select(
        "id, display_name, picture_url, chat_messages(content, created_at, direction, read_at)"
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

          if (selectedFriendId && newMsg.friend_id === selectedFriendId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            if (newMsg.direction === "inbound") {
              supabase
                .from("chat_messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", newMsg.id)
                .then();
            }
          }

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

  // Filter friends
  const filteredFriends = friends.filter((friend) => {
    const matchesSearch = !searchQuery || 
      friend.display_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUnread = !filterUnread || 
      (friend.chat_messages[0]?.direction === "inbound" && !friend.chat_messages[0]?.read_at);
    return matchesSearch && matchesUnread;
  });

  // Check if friend has unread messages
  const hasUnread = (friend: ChatFriend) => {
    return friend.chat_messages[0]?.direction === "inbound" && !friend.chat_messages[0]?.read_at;
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#F7F8FA]">
      {/* Left panel: chat list */}
      <div
        className={`flex w-full flex-col border-r border-gray-200 bg-white sm:w-80 lg:w-96 sm:shrink-0 ${
          selectedFriendId ? "hidden sm:flex" : "flex"
        }`}
      >
        {/* Search & Filter */}
        <div className="shrink-0 border-b border-gray-100 p-4 space-y-3">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="チャットを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#06C755] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterUnread(false)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                !filterUnread
                  ? "bg-[#06C755] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              全て
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                filterUnread
                  ? "bg-[#06C755] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              未返信
            </button>
          </div>
        </div>

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto">
          {loadingFriends ? (
            <div className="space-y-1 p-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="mt-1.5 h-3 w-36 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="mt-3 text-sm text-gray-500">チャット履歴がありません</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredFriends.map((friend) => {
                const lastMsg = friend.chat_messages?.[0];
                const isUnread = hasUnread(friend);
                const isSelected = selectedFriendId === friend.id;
                
                return (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${
                      isSelected
                        ? "bg-[#06C755]/10"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="relative">
                      {friend.picture_url ? (
                        <img
                          src={friend.picture_url}
                          alt={friend.display_name}
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#06C755]/10 text-sm font-bold text-[#06C755]">
                          {friend.display_name?.charAt(0) ?? "?"}
                        </div>
                      )}
                      {isUnread && (
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-orange-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-900"}`}>
                          {friend.display_name}
                        </span>
                        {lastMsg && (
                          <span className="shrink-0 text-xs text-gray-400">
                            {timeAgo(lastMsg.created_at)}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className={`mt-0.5 truncate text-xs ${isUnread ? "font-medium text-gray-700" : "text-gray-500"}`}>
                          {lastMsg.direction === "outbound" && (
                            <span className="text-gray-400">あなた: </span>
                          )}
                          {getContentText(lastMsg.content)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: chat window */}
      <div
        className={`flex flex-1 flex-col bg-[#F7F8FA] ${
          !selectedFriendId ? "hidden sm:flex" : "flex"
        }`}
      >
        {selectedFriendId && selectedFriend ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
              <button
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:hidden"
                onClick={() => setSelectedFriendId(null)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative">
                {selectedFriend.picture_url ? (
                  <img
                    src={selectedFriend.picture_url}
                    alt={selectedFriend.display_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#06C755]/10 text-sm font-bold text-[#06C755]">
                    {selectedFriend.display_name?.charAt(0) ?? "?"}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#06C755]" />
              </div>
              <div className="flex-1">
                <span className="font-medium text-gray-900">{selectedFriend.display_name}</span>
                <p className="text-xs text-gray-500">オンライン</p>
              </div>
              <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#06C755] border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">メッセージはありません</p>
                  <p className="text-xs text-gray-400">会話を始めましょう</p>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.map((msg, index) => {
                    const isOutbound = msg.direction === "outbound";
                    const showDateDivider = index === 0 || 
                      formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at);
                    
                    return (
                      <div key={msg.id}>
                        {showDateDivider && (
                          <div className="flex items-center justify-center py-4">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div className={`group relative max-w-xs lg:max-w-md ${isOutbound ? "" : "pl-2"}`}>
                            <div
                              className={`rounded-2xl px-4 py-2.5 ${
                                isOutbound
                                  ? "bg-[#06C755] text-white"
                                  : "bg-white text-gray-900 shadow-sm border border-gray-100"
                              }`}
                            >
                              <p className="whitespace-pre-wrap text-sm">{getContentText(msg.content)}</p>
                            </div>
                            <p
                              className={`mt-1 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 ${
                                isOutbound ? "text-right" : "text-left"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-gray-200 bg-white p-4">
              <div className="mx-auto flex max-w-2xl items-end gap-3">
                {/* Quick reply button */}
                <button className="shrink-0 rounded-lg p-2.5 text-gray-500 hover:bg-gray-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                
                <div className="relative flex-1">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="メッセージを入力..."
                    rows={1}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#06C755] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#06C755]/20"
                    style={{ maxHeight: "120px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sending}
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending || !inputMessage.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#06C755] text-white transition-all hover:bg-[#05A649] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">メッセージを選択</p>
              <p className="mt-1 text-sm text-gray-500">左側から会話を選択してください</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
