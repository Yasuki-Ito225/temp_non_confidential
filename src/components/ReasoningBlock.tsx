"use client";

import { useState, useEffect } from "react";
import { TraceEntry } from "@/types/trace";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReasoningBlockProps {
  entries: TraceEntry[];
  isStreaming: boolean;
  showTrace: boolean;
}

export default function ReasoningBlock({ entries, isStreaming, showTrace }: ReasoningBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (!isStreaming) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [isStreaming]);

  const visibleEntries = entries.filter((entry) => {
    if (entry.type === "rationale") return true;
    return showTrace;
  });

  if (visibleEntries.length === 0) return null;

  return (
    <div className="reasoning-block">
      <button
        className="reasoning-block__toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls="reasoning-content"
      >
        <span className="reasoning-block__icon">{collapsed ? "▶" : "▼"}</span>
        <span className="reasoning-block__label">
          {isStreaming ? "思考中..." : "推論過程を表示"}
        </span>
      </button>

      {!collapsed && (
        <div id="reasoning-content" className="reasoning-block__content">
          {visibleEntries.map((entry, idx) => {
            if (entry.type === "rationale") {
              return (
                <div key={idx} className="reasoning-block__rationale">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {entry.text ?? ""}
                  </ReactMarkdown>
                </div>
              );
            }
            if (entry.type === "action_group") {
              return (
                <p key={idx} className="reasoning-block__action">
                  [アクション] {entry.name}
                  {entry.input && <span className="reasoning-block__input">: {entry.input}</span>}
                </p>
              );
            }
            if (entry.type === "knowledge_base") {
              return (
                <p key={idx} className="reasoning-block__kb">
                  [KB検索] {entry.name}
                  {entry.input && <span className="reasoning-block__input">: {entry.input}</span>}
                </p>
              );
            }
            return null;
          })}
          {isStreaming && (
            <span className="reasoning-block__cursor" aria-label="思考中" />
          )}
        </div>
      )}
    </div>
  );
}
