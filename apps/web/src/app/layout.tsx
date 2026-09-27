import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'OTA デモ',
  description: 'オンライン旅行代理店のデモサイト。実際の予約・決済は行われません。',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div role="note" aria-label="デモサイトの注意">
          これはデモサイトです。実際の予約・決済は行われません。
        </div>
        {children}
      </body>
    </html>
  );
}
