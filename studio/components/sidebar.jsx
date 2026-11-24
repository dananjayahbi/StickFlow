'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
  CalendarClock, FolderOpen, Images, LayoutDashboard, Settings,
} from 'lucide-react';

const links = [
  {href: '/', label: 'Overview', icon: LayoutDashboard},
  {href: '/gallery', label: 'Gallery', icon: Images},
  {href: '/projects', label: 'Projects', icon: FolderOpen},
  {href: '/planner', label: 'Publish planner', icon: CalendarClock},
  {href: '/settings', label: 'Settings', icon: Settings},
];

export default function Sidebar({defaultEngine}) {
  const pathname = usePathname() || '/';
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">S</span>
        <span>
          <span className="brand-name">StickFlow</span>
          <span className="brand-sub">Studio</span>
        </span>
      </Link>

      <nav className="nav">
        <div className="nav-label">Workspace</div>
        {links.map(({href, label, icon: Icon}) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`nav-link ${active ? 'active' : ''}`}>
              <Icon size={15} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="engine-pill">
          <span className="muted">Default voice</span>
          <strong>{defaultEngine === 'qwen' ? 'Qwen' : 'Kokoro'}</strong>
        </div>
        <div className="local-note">Local · 127.0.0.1</div>
      </div>
    </aside>
  );
}
