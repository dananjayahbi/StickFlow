import './globals.css';
import {loadConfig} from '../lib/config.mjs';
import Sidebar from '../components/sidebar.jsx';

export const metadata = {
  title: 'StickFlow Studio',
  description: 'Local gallery, project status and publish planner for StickFlow videos.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootLayout({children}) {
  const config = loadConfig();
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar defaultEngine={config.tts.defaultEngine} />
          <main className="main">
            <div className="main-inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
