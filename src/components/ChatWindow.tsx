"use client";

import { useState, useRef, useEffect } from "react";
import { TemplateItem } from "@/types/config";
import { TraceEntry } from "@/types/trace";
import MessageList from "./MessageList";
import TemplateButtons from "./TemplateButtons";
import FileAttachment from "./FileAttachment";
import TraceToggle from "./TraceToggle";

interface AttachedFile {
  name: string;
  mediaType: string;
  base64Data: string;
}

interface ExtendedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
}

interface ChatWindowProps {
  appTitle: string;
  agentId: string;
  agentAliasId: string;
  templates: TemplateItem[];
}

/**
 * Vercel AI SDK の useChat フックは、リクエスト body を
 * JSON.stringify() した文字列（application/json）として生成する。
 * 本関数はこの前提に基づき、string 型の body のみを対象として
 * SHA-256 ハッシュを計算する。
 *
 * 前提：
 *   - body は Vercel AI SDK が生成する JSON 文字列であること
 *   - Content-Type は application/json であること
 *   - fetch オプションのカスタマイズ以外の方法でリクエストを
 *     送信する場合（例：fetch を直接呼ぶ独自実装）には
 *     本関数は使用しないこと
 *
 * body が string 以外の型（ArrayBuffer、FormData、ReadableStream 等）
 * で渡された場合は想定外の呼び出しとして例外をスローする。
 * これにより、AI SDK のバージョンアップ等で body の型が変わった
 * 場合に無言で誤ったハッシュを送信することを防ぐ。
 */
const computeBodyHash = async (body: BodyInit | null | undefined): Promise<string> => {
  if (body === null || body === undefined || body === "") {
    // 空 body の SHA-256（RFC 規定値）
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  }

  if (typeof body !== "string") {
    // Vercel AI SDK useChat の前提（JSON 文字列）から外れる型が来た場合は
    // 誤ったハッシュを送信しないよう明示的に例外をスローする
    throw new Error(
      `computeBodyHash: unexpected body type "${typeof body}". ` +
      "This function assumes Vercel AI SDK useChat generates a JSON string body."
    );
  }

  const encoded = new TextEncoder().encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
};

export default function ChatWindow({
  appTitle,
  agentId,
  agentAliasId,
  templates,
}: ChatWindowProps) {
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showError(msg: string) {
    setErrorMessage(msg);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setShowToast(false), 5000);
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  async function sendMessage(text: string, file: AttachedFile | null) {
    if (!text.trim() || isLoading) return;

    const userMsg: ExtendedMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: ExtendedMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      reasoning: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const requestBody = JSON.stringify({
        messages: [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        sessionId,
        agentId,
        agentAliasId,
        attachedFile: file ?? null,
      });
      const bodyHash = await computeBodyHash(requestBody);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-amz-content-sha256": bodyHash,
        },
        body: requestBody,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const colonIdx = line.indexOf(":");
          if (colonIdx === -1) continue;
          const prefix = line.slice(0, colonIdx);
          const payload = line.slice(colonIdx + 1);

          try {
            const parsed = JSON.parse(payload);
            if (prefix === "0") {
              // text part
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + parsed } : m
                )
              );
            } else if (prefix === "g") {
              // reasoning part
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, reasoning: (m.reasoning ?? "") + parsed + "\n" }
                    : m
                )
              );
            } else if (prefix === "3") {
              // error part
              showError(typeof parsed === "string" ? parsed : "エラーが発生しました。");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content || "エラーが発生しました。再度お試しください。" }
                    : m
                )
              );
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message.includes("fetch")
            ? "通信エラーが発生しました。ネットワーク接続を確認してください。"
            : err.message
          : "AIエージェントとの通信でエラーが発生しました。しばらく待ってから再度お試しください。";
      showError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || "エラーが発生しました。再度お試しください。" }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input, attachedFile);
  }

  function handleTemplateSelect(text: string) {
    sendMessage(text, null);
  }

  const reasoningMap: Record<string, TraceEntry[]> = {};
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.reasoning) {
      const entries: TraceEntry[] = [];
      for (const line of msg.reasoning.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          entries.push(JSON.parse(trimmed) as TraceEntry);
        } catch {
          // skip
        }
      }
      reasoningMap[msg.id] = entries;
    }
  }

  return (
    <div className="chat-window">
      {showToast && errorMessage && (
        <div className="toast-container" role="alert" aria-live="assertive">
          <div className="toast toast--error">
            <span>{errorMessage}</span>
            <button
              className="toast__close"
              onClick={() => setShowToast(false)}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <header className="chat-window__header">
        <h1 className="chat-window__title">{appTitle}</h1>
        <TraceToggle showTrace={showTrace} onToggle={setShowTrace} />
      </header>

      <MessageList
        messages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          reasoning: reasoningMap[m.id] ?? [],
        }))}
        isLoading={isLoading}
        showTrace={showTrace}
      />

      {templates.length > 0 && messages.length === 0 && !isLoading && (
        <TemplateButtons
          templates={templates}
          onSelect={handleTemplateSelect}
          disabled={isLoading}
        />
      )}

      <form className="chat-window__input-area" onSubmit={handleSubmit}>
        <FileAttachment
          attachedFile={attachedFile}
          onAttach={setAttachedFile}
          onRemove={() => setAttachedFile(null)}
          disabled={isLoading}
        />
        <div className="chat-window__input-row">
          <textarea
            className="chat-window__textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="メッセージを入力してください（Shift+Enterで改行）"
            disabled={isLoading}
            rows={3}
            aria-label="メッセージ入力"
          />
          <button
            type="submit"
            className="chat-window__send-button"
            disabled={isLoading || !input.trim()}
            aria-label="送信"
          >
            {isLoading ? "送信中..." : "送信"}
          </button>
        </div>
      </form>
    </div>
  );
}
