export type ColorTheme = "konjo" | "asagi" | "sumire" | "tsutsuji" | "kurikawa";

export interface AppConfig {
  appTitle: string;
  agentId: string;
  agentAliasId: string;
  colorTheme: ColorTheme;
}

export interface TemplateItem {
  label: string;
  text: string;
}

export interface TemplatesConfig {
  templates: TemplateItem[];
}
