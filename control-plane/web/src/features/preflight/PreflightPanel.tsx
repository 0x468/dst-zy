import { Panel } from "../../components/ui/Panel";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { PreflightReport } from "../../lib/api";

type PreflightPanelProps = {
  title: string;
  eyebrow?: string;
  report?: PreflightReport;
  pending?: boolean;
  errorMessage?: string;
  onRefresh?: () => Promise<void> | void;
};

export function PreflightPanel({
  title,
  eyebrow,
  report,
  pending = false,
  errorMessage,
  onRefresh,
}: PreflightPanelProps) {
  const checks = report?.checks ?? [];

  return (
    <Panel
      title={title}
      eyebrow={eyebrow}
      className="preflight-panel"
      actions={onRefresh ? (
        <button type="button" disabled={pending} onClick={() => void onRefresh()}>
          Refresh preflight
        </button>
      ) : undefined}
    >
      {pending ? <p className="preflight-panel__state">Running preflight checks...</p> : null}
      {errorMessage ? <p className="preflight-panel__state preflight-panel__state--error">{errorMessage}</p> : null}
      {report ? (
        <>
          <div className="preflight-panel__summary" aria-label={`${title} summary`}>
            <StatusBadge status={report.status} />
            <p className="preflight-panel__counts">
              <strong>{report.fatalCount} fatal</strong>
              <span>{report.warningCount} warning</span>
            </p>
          </div>
          {checks.length > 0 ? (
            <ul className="preflight-panel__list">
              {checks.map((check) => (
                <li key={`${check.code}-${check.summary}`} className="preflight-panel__item">
                  <div className="preflight-panel__item-header">
                    <strong>{check.summary}</strong>
                    <StatusBadge status={check.severity} />
                  </div>
                  {check.detail ? <p className="preflight-panel__detail">{check.detail}</p> : null}
                  {check.hint ? <p className="preflight-panel__hint">{check.hint}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="record-panel__empty">No blocking or warning checks were reported.</p>
          )}
        </>
      ) : null}
    </Panel>
  );
}
