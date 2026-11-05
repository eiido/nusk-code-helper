import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'مساعد أكواد نسك | انسخ بسهولة وكمّل من مكانك',
  description: 'أداة مستقلة مجانية لتسهيل نسخ أكواد تحدي نسك ومتابعتها، مع دليل وروابط رسمية ومعلومات موثقة عن المسابقة.',
  applicationName: 'مساعد أكواد نسك',
  icons: { icon: '/icon.svg' },
  openGraph: { title: 'مساعد أكواد نسك', description: 'أكواد، متابعة، ودليل واضح. مبادرة مستقلة مجانية.', locale: 'ar_EG', type: 'website' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#173e34' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions may inject attributes (for example location) on body before hydration.
  // Limit this escape hatch to body attributes; child hydration mismatches remain visible.
  return <html lang="ar" dir="rtl"><body suppressHydrationWarning>{children}</body></html>;
}
