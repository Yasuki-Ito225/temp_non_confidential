export type TraceType = "rationale" | "action_group" | "knowledge_base";

export interface RationaleTrace {
  type: "rationale";
  text: string;
}

export interface ActionGroupTrace {
  type: "action_group";
  name: string;
  input: string;
}

export interface KnowledgeBaseTrace {
  type: "knowledge_base";
  name: string;
  input: string;
}

export type TraceEntry = RationaleTrace | ActionGroupTrace | KnowledgeBaseTrace;
