"use client";

import { useEffect, useRef } from "react";
import { TraceEntry } from "@/types/trace";
import MessageBubble from "./MessageBubble";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning: TraceEntry[];
}

interface MessageListProps {
  messages: MessageItem[];
  isLoading: boolean;
  showTrace: boolean;
}

export default function MessageList({ messages, isLoading, showTrace }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <p className="message-list__empty-text">メッセージを入力して会話を始めてください。</p>
      </div>
    );
  }

  return (
    <div className="message-list" role="log" aria-live="polite" aria-label="チャット履歴">
      {messages.map((msg, idx) => {
        const isStreaming =
          isLoading && idx === messages.length - 1 && msg.role === "assistant";
        return (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            reasoning={msg.reasoning}
            isStreaming={isStreaming}
            showTrace={showTrace}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
