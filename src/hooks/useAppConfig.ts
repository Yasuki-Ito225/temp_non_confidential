"use client";

import { useState, useEffect } from "react";
import { AppConfig, TemplatesConfig } from "@/types/config";

interface UseAppConfigResult {
  appConfig: AppConfig | null;
  templates: TemplatesConfig | null;
  loading: boolean;
  error: string | null;
}

const DEFAULT_CONFIG_PATH = "/config/app-config.json";
const DEFAULT_TEMPLATES_PATH = "/config/templates.json";

export function useAppConfig(): UseAppConfigResult {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [templates, setTemplates] = useState<TemplatesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfigs() {
      try {
        const [configRes, templatesRes] = await Promise.all([
          fetch(DEFAULT_CONFIG_PATH),
          fetch(DEFAULT_TEMPLATES_PATH),
        ]);

        if (!configRes.ok) {
          throw new Error(`Failed to fetch app-config.json: ${configRes.status}`);
        }
        if (!templatesRes.ok) {
          throw new Error(`Failed to fetch templates.json: ${templatesRes.status}`);
        }

        const [configData, templatesData] = await Promise.all([
          configRes.json() as Promise<AppConfig>,
          templatesRes.json() as Promise<TemplatesConfig>,
        ]);

        setAppConfig(configData);
        setTemplates(templatesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "設定ファイルの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    }

    fetchConfigs();
  }, []);

  return { appConfig, templates, loading, error };
}
