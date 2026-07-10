import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  InvokeAgentCommandInput,
  ResponseStream,
} from "@aws-sdk/client-bedrock-agent-runtime";

export interface AttachedFile {
  name: string;
  mediaType: string;
  base64Data: string;
}

export interface InvokeAgentOptions {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  inputText: string;
  attachedFile?: AttachedFile | null;
}

const client = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

export async function invokeAgent(options: InvokeAgentOptions): Promise<AsyncIterable<ResponseStream>> {
  const { agentId, agentAliasId, sessionId, inputText, attachedFile } = options;

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

  const command = new InvokeAgentCommand({
    agentId,
    agentAliasId,
    sessionId,
    inputText,
    enableTrace: true,
    sessionState,
  });

  const response = await client.send(command);

  if (!response.completion) {
    throw new Error("No completion stream returned from Bedrock Agent");
  }

  return response.completion;
}
