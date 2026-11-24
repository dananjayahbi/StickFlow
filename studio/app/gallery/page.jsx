import Link from 'next/link';
import {loadConfig} from '../../lib/config.mjs';
import {collectProjects} from '../../lib/summary.mjs';
import GalleryView from '../../components/gallery-view.jsx';

export const dynamic = 'force-dynamic';

export default function GalleryPage() {
  const config = loadConfig();
  const projects = collectProjects(config);
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Gallery</div>
          <h1 className="page-title">Finished work,<br />ready to send.</h1>
          <p className="page-sub">Published gallery items first, with private work available on demand. Posters, voice and publish state come straight from Storage.</p>
        </div>
        <Link href="/projects" className="btn">Manage projects</Link>
      </header>
      <GalleryView projects={projects} />
    </>
  );
}
