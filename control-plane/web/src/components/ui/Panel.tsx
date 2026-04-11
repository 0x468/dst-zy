import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PanelProps = ComponentPropsWithoutRef<"section"> & {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "subtle";
};

export function Panel({ title, eyebrow, actions, tone = "default", className, children, ...props }: PanelProps) {
  const panelClassName = ["panel", tone === "subtle" ? "panel--subtle" : "", className]
    .filter(Boolean)
    .join(" ");
  const hasHeader = title || eyebrow || actions;

  return (
    <section className={panelClassName} {...props}>
      {hasHeader ? (
        <header className="panel__header">
          <div>
            {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="panel__title">{title}</h2> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}
