import CraTimelinePanel from '../components/CraTimelinePanel.js';

export default function CraTimelinePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-white">CRA Regulatory Timeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Regulation (EU) 2024/2847 — Cyber Resilience Act enforcement milestones
        </p>
      </div>
      <CraTimelinePanel variant="full" />
    </div>
  );
}
