import './globals.css';
import ClientHeader from '@/components/ClientHeader';

export const metadata = {
  title: 'NeoOhio Underwriter',
  description: 'Internal underwriting tool'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <ClientHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
