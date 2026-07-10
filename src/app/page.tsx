"use client";

import { SerendieProvider } from "@serendie/ui";
import ChatWindow from "@/components/ChatWindow";
import { useAppConfig } from "@/hooks/useAppConfig";

export default function Home() {
  const { appConfig, templates, loading, error } = useAppConfig();

  if (loading) {
    return <div className="loading-screen">読み込み中...</div>;
  }

  if (error || !appConfig || !templates) {
    return (
      <div className="error-screen">
        設定ファイルの読み込みに失敗しました。<br />
        {error}
      </div>
    );
  }

  return (
    <SerendieProvider lang="ja" colorTheme={appConfig.colorTheme} colorMode="system">
      <ChatWindow
        appTitle={appConfig.appTitle}
        agentId={appConfig.agentId}
        agentAliasId={appConfig.agentAliasId}
        templates={templates.templates}
      />
    </SerendieProvider>
  );
}
