import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pokopia-destiny-test.coral-root-8045.chatgpt.site'),
  title: 'Pokopia 命定宝可梦测试',
  description: '从 Pokopia 的物品喜好、口味与环境偏好出发，测测你在宝可梦世界最像谁。',
  openGraph: {
    title: 'Pokopia 命定宝可梦测试',
    description: '测测你在宝可梦世界最像谁。',
    images: [{ url: 'https://pokopia-destiny-test.coral-root-8045.chatgpt.site/og.png', width: 1536, height: 806, alt: 'Pokopia 命定宝可梦测试' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pokopia 命定宝可梦测试',
    description: '测测你在宝可梦世界最像谁。',
    images: ['https://pokopia-destiny-test.coral-root-8045.chatgpt.site/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
