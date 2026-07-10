/**
 * Lambda entry point for the Bedrock Agent Chat API.
 *
 * Deployed as an AWS Lambda Function URL with RESPONSE_STREAM invocation mode.
 * Handles POST /api/chat requests and streams responses in Vercel AI SDK
 * Data Stream Protocol format.
 */

import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  InvokeAgentCommandInput,
} from "@aws-sdk/client-bedrock-agent-runtime";

// ── Types ─────────────────────────────────────────────────────────────────

interface AttachedFile {
  name: string;
  mediaType: string;
  base64Data: string;
}

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  sessionId: string;
  agentId: string;
  agentAliasId: string;
  attachedFile?: AttachedFile | null;
}

// Lambda streaming response types (awslambda global)
declare const awslambda: {
  streamifyResponse(
    handler: (
      event: LambdaEvent,
      responseStream: ResponseStream,
      context: LambdaContext
    ) => Promise<void>
  ): LambdaHandler;
  HttpResponseStream: {
    from(
      stream: ResponseStream,
      metadata: { statusCode: number; headers: Record<string, string> }
    ): ResponseStream;
  };
};

interface LambdaEvent {
  requestContext?: { http?: { method?: string } };
  body?: string;
  isBase64Encoded?: boolean;
}

interface ResponseStream {
  write(chunk: Buffer | string): void;
  end(): void;
  destroy(err?: Error): void;
}

interface LambdaContext {
  getRemainingTimeInMillis(): number;
}

type LambdaHandler = (
  event: LambdaEvent,
  responseStream: ResponseStream,
  context: LambdaContext
) => Promise<void>;

// ── Helpers ───────────────────────────────────────────────────────────────

const client = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

function aiPart(prefix: string, value: unknown): string {
  return `${prefix}:${JSON.stringify(value)}\n`;
}

function parseBody(event: LambdaEvent): ChatRequestBody | null {
  try {
    let raw = event.body ?? "{}";
    if (event.isBase64Encoded) {
      raw = Buffer.from(raw, "base64").toString("utf-8");
    }
    return JSON.parse(raw) as ChatRequestBody;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────

export const handler: LambdaHandler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const httpStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
        "Cache-Control": "no-cache, no-transform",
      },
    });

    const body = parseBody(event);

    if (!body) {
      httpStream.write(aiPart("3", "Invalid request body"));
      httpStream.end();
      return;
    }

    const { messages, sessionId, agentId, agentAliasId, attachedFile } = body;

    if (!messages || !sessionId || !agentId || !agentAliasId) {
      httpStream.write(aiPart("3", "Missing required fields"));
      httpStream.end();
      return;
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!latestUserMessage) {
      httpStream.write(aiPart("3", "No user message found"));
      httpStream.end();
      return;
    }

    // Build file payload if attached
    let sessionState: InvokeAgentCommandInput["sessionState"] = undefined;
    if (attachedFile) {
      sessionState = {
        files: [
          {
            name: attachedFile.name,
            useCase: "CHAT",
            source: {
              sourceType: "BYTE_CONTENT",
              byteContent: {
                mediaType: attachedFile.mediaType,
                data: Buffer.from(attachedFile.base64Data, "base64"),
              },
            },
          },
        ],
      };
    }

    try {
      const command = new InvokeAgentCommand({
        agentId,
        agentAliasId,
        sessionId,
        inputText: latestUserMessage.content,
        enableTrace: true,
        sessionState,
      });

      const response = await client.send(command);

      if (!response.completion) {
        httpStream.write(aiPart("3", "No completion stream from Bedrock Agent"));
        httpStream.end();
        return;
      }

      for await (const event of response.completion) {
        // log for debugging
        console.log(JSON.stringify({
          ts: Date.now(),
          hasChunk: !!event.chunk?.bytes,
          hasTrace: !!event.trace,
          remaining: context.getRemainingTimeInMillis(),
        }))
        // log for degugging end

        // Guard: stop streaming if Lambda is close to timeout (5 s buffer)
        if (context.getRemainingTimeInMillis() < 5000) {
          break;
        }

        if (event.chunk?.bytes) {
          const text = Buffer.from(event.chunk.bytes).toString("utf-8");
          httpStream.write(aiPart("0", text));
        }

        if (event.trace?.trace?.orchestrationTrace) {
          const orchTrace = event.trace.trace.orchestrationTrace;

          if (orchTrace.rationale?.text) {
            const entry = JSON.stringify({ type: "rationale", text: orchTrace.rationale.text });
            httpStream.write(aiPart("g", entry));
          }

          if (orchTrace.invocationInput?.actionGroupInvocationInput) {
            const ag = orchTrace.invocationInput.actionGroupInvocationInput;
            const entry = JSON.stringify({
              type: "action_group",
              name: ag.actionGroupName ?? "unknown",
              input: ag.requestBody ? JSON.stringify(ag.requestBody) : "",
            });
            httpStream.write(aiPart("g", entry));
          }

          if (orchTrace.invocationInput?.knowledgeBaseLookupInput) {
            const kb = orchTrace.invocationInput.knowledgeBaseLookupInput;
            const entry = JSON.stringify({
              type: "knowledge_base",
              name: kb.knowledgeBaseId ?? "unknown",
              input: kb.text ?? "",
            });
            httpStream.write(aiPart("g", entry));
          }
        }
      }

      httpStream.write(aiPart("d", { finishReason: "stop" }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "AIエージェントとの通信でエラーが発生しました。";
      httpStream.write(aiPart("3", message));
    } finally {
      httpStream.end();
    }
  }
);
