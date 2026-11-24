import {loadConfig} from '../../lib/config.mjs';
import {buildSettings} from '../../lib/summary.mjs';
import SettingsView from '../../components/settings-view.jsx';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const config = loadConfig();
  const initial = buildSettings(config);
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="page-title">Choose the voice.</h1>
          <p className="page-sub">
            These choices write <span className="mono">stickflow.config.json</span>. The next narration
            run reads them automatically, whether it starts from the CLI or the agent.
          </p>
        </div>
      </header>
      <SettingsView initial={initial} />
    </>
  );
}
