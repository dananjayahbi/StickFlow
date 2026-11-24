import PlannerView from '../../components/planner-view.jsx';

export const dynamic = 'force-dynamic';

export default function PlannerPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Publish planner</div>
          <h1 className="page-title">Give the work<br />a release date.</h1>
          <p className="page-sub">
            Scheduling is local metadata only. StickFlow does not post to platforms for you;
            it keeps the date, platform targets and status in one place.
          </p>
        </div>
      </header>
      <PlannerView />
    </>
  );
}
