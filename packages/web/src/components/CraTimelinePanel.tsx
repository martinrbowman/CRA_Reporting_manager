import { CheckCircle, Clock, AlertTriangle, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  CRA_MILESTONES, localDaysUntil, milestoneStatus, nextUpcomingMilestone,
  type MilestoneStatus,
} from '../lib/craMilestones.js';

function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'passed') return <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />;
  if (status === 'imminent') return <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />;
  return <Circle className="w-5 h-5 text-gray-500 flex-shrink-0" />;
}

function CountdownBadge({ dateStr }: { dateStr: string }) {
  const days = localDaysUntil(dateStr);
  if (days < 0) {
    return (
      <span className="text-xs text-gray-500">
        {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
      </span>
    );
  }
  const color = days <= 30 ? 'text-red-400' : days <= 90 ? 'text-yellow-400' : 'text-blue-400';
  return (
    <span className={`text-sm font-semibold font-mono ${color}`}>
      {days}d remaining
    </span>
  );
}

interface Props {
  /** 'full' renders the vertical timeline with all milestones (CRA Timeline page).
   *  'compact' renders only the next-upcoming banner (Dashboard embed). */
  variant?: 'full' | 'compact';
}

export default function CraTimelinePanel({ variant = 'full' }: Props) {
  const nextUpcoming = nextUpcomingMilestone();
  const nextDays = nextUpcoming ? localDaysUntil(nextUpcoming.date) : null;

  const banner = nextUpcoming && nextDays !== null && (
    <div className={`rounded-lg border p-4 ${nextDays <= 90 ? 'bg-yellow-900/20 border-yellow-800' : 'bg-blue-900/10 border-blue-900'}`}>
      <div className="flex items-start gap-2">
        <Clock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${nextDays <= 90 ? 'text-yellow-400' : 'text-blue-400'}`} />
        <div>
          <p className={`text-sm font-semibold ${nextDays <= 90 ? 'text-yellow-300' : 'text-blue-300'}`}>
            Next milestone: {nextUpcoming.title}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(nextUpcoming.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}<span className="font-semibold">{nextDays} days</span> remaining
          </p>
        </div>
      </div>
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">CRA Regulatory Timeline</h2>
        {banner ?? <p className="text-sm text-gray-500">All milestones passed.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner}

      <div className="relative">
        <div className="absolute left-[9px] top-6 bottom-6 w-px bg-gray-800" />

        <div className="space-y-6">
          {CRA_MILESTONES.map((m) => {
            const status = milestoneStatus(m.date);
            return (
              <div key={m.date} className="flex gap-4">
                <div className="mt-1">
                  <StatusIcon status={status} />
                </div>
                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <p className={`text-sm font-semibold ${status === 'passed' ? 'text-gray-300' : 'text-white'}`}>
                        {m.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.article}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400 font-mono">
                        {new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="mt-0.5">
                        <CountdownBadge dateStr={m.date} />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{m.description}</p>
                  {m.critical && status !== 'passed' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-500 font-medium">Critical obligation — preparation required</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-500">
          <span className="text-gray-400 font-medium">Source:</span> Regulation (EU) 2024/2847 of the European Parliament and of the Council, published OJ L, 20 November 2024.
          Dates calculated from Art. 71. Consult legal counsel for jurisdiction-specific obligations.
        </p>
      </div>
    </div>
  );
}
