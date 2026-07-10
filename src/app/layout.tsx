import type { Metadata } from "next";
import { getColorSchemeScript } from "@serendie/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bedrock Agent チャットUI",
  description: "AWS Bedrock AgentとチャットするWebインターフェース",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* FOUC防止: SerendieのカラースキームをSSR時に確定する */}
        <script
          dangerouslySetInnerHTML={{
            __html: getColorSchemeScript({ colorMode: "system" }),
          }}
        />
        {/* @serendie/ui design system styles – served as a static asset to
            avoid Next.js 14's cssnano-simple crashing on @layer declarations */}
        <link rel="stylesheet" href="/serendie-ui.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
