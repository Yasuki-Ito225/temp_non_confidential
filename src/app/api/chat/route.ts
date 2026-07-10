import { NextRequest } from "next/server";
import { invokeAgent, AttachedFile } from "@/lib/bedrock";

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  sessionId: string;
  agentId: string;
  agentAliasId: string;
  attachedFile?: AttachedFile | null;
}

function encodeAIStreamPart(type: string, value: unknown): string {
  if (type === "text") {
    return `0:${JSON.stringify(value)}\n`;
  }
  if (type === "reasoning") {
    return `g:${JSON.stringify(value)}\n`;
  }
  if (type === "finish") {
    return `d:${JSON.stringify(value)}\n`;
  }
  if (type === "error") {
    return `3:${JSON.stringify(value)}\n`;
  }
  return "";
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      encodeAIStreamPart("error", "Invalid request body"),
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const { messages, sessionId, agentId, agentAliasId, attachedFile } = body;

  if (!messages || !sessionId || !agentId || !agentAliasId) {
    return new Response(
      encodeAIStreamPart("error", "Missing required fields"),
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!latestUserMessage) {
    return new Response(
      encodeAIStreamPart("error", "No user message found"),
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await invokeAgent({
          agentId,
          agentAliasId,
          sessionId,
          inputText: latestUserMessage.content,
          attachedFile,
        });

        for await (const event of completion) {
          if (event.chunk?.bytes) {
            const text = new TextDecoder().decode(event.chunk.bytes);
            controller.enqueue(encoder.encode(encodeAIStreamPart("text", text)));
          }

          if (event.trace?.trace?.orchestrationTrace) {
            const orchTrace = event.trace.trace.orchestrationTrace;

            if (orchTrace.rationale?.text) {
              const entry = JSON.stringify({ type: "rationale", text: orchTrace.rationale.text });
              controller.enqueue(encoder.encode(encodeAIStreamPart("reasoning", entry)));
            }

            if (orchTrace.invocationInput?.actionGroupInvocationInput) {
              const ag = orchTrace.invocationInput.actionGroupInvocationInput;
              const entry = JSON.stringify({
                type: "action_group",
                name: ag.actionGroupName ?? "unknown",
                input: ag.requestBody ? JSON.stringify(ag.requestBody) : "",
              });
              controller.enqueue(encoder.encode(encodeAIStreamPart("reasoning", entry)));
            }

            if (orchTrace.invocationInput?.knowledgeBaseLookupInput) {
              const kb = orchTrace.invocationInput.knowledgeBaseLookupInput;
              const entry = JSON.stringify({
                type: "knowledge_base",
                name: kb.knowledgeBaseId ?? "unknown",
                input: kb.text ?? "",
              });
              controller.enqueue(encoder.encode(encodeAIStreamPart("reasoning", entry)));
            }
          }
        }

        controller.enqueue(
          encoder.encode(encodeAIStreamPart("finish", { finishReason: "stop" }))
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "AIエージェントとの通信でエラーが発生しました。";
        controller.enqueue(encoder.encode(encodeAIStreamPart("error", message)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
