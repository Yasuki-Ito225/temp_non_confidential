"use client";

import { TraceEntry } from "@/types/trace";
import ReasoningBlock from "./ReasoningBlock";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  reasoning: TraceEntry[];
  isStreaming: boolean;
  showTrace: boolean;
}

export default function MessageBubble({
  role,
  content,
  reasoning,
  isStreaming,
  showTrace,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`message-bubble message-bubble--${isUser ? "user" : "assistant"}`}
      aria-label={isUser ? "あなたのメッセージ" : "アシスタントのメッセージ"}
    >
      <div className="message-bubble__avatar">
        {isUser ? "You" : "AI"}
      </div>
      <div className="message-bubble__body">
        {!isUser && reasoning.length > 0 && (
          <ReasoningBlock
            entries={reasoning}
            isStreaming={isStreaming}
            showTrace={showTrace}
          />
        )}
        <div className={`message-bubble__content${isStreaming ? " message-bubble__content--streaming" : ""}`}>
          {content || (isStreaming ? <span className="message-bubble__cursor" aria-label="入力中" /> : null)}
        </div>
      </div>
    </div>
  );
}
