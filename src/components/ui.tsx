/**
 * Shared monochrome UI primitives.
 *
 * Every page composes from these so the black-and-white rule is enforced in one
 * place: status is carried by fill, border style, glyph and explicit words —
 * never by hue. See `src/app/globals.css` for the token rationale.
 *
 * Server components only (no "use client") so they can be used from layouts,
 * pages and async data loaders alike.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-zinc-900 pb-5">
      <p className="mm-eyebrow">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-zinc-600">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({
  title,
  description,
  meta,
  action,
  children,
  footer,
  flat,
}: {
  title?: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flat?: boolean;
}) {
  const framed = title || description || meta || action;
  return (
    <div className={flat ? "mm-card-flat p-5" : "mm-card p-5"}>
      {framed && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {meta && <div className="mt-2">{meta}</div>}
      <div className={framed ? "mt-4" : undefined}>{children}</div>
      {footer && <div className="mm-rule mt-4 pt-3 text-xs text-zinc-500">{footer}</div>}
    </div>
  );
}

export type BadgeVariant = "solid" | "outline" | "muted" | "dotted";

export function Badge({
  variant = "muted",
  children,
  title,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`mm-badge mm-badge-${variant}`} title={title}>
      {children}
    </span>
  );
}

export function Bar({
  value,
  max = 100,
  hatched = false,
  className,
}: {
  value: number;
  max?: number;
  hatched?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <span className={`mm-bar-track ${className ?? ""}`}>
      <span
        className={hatched ? "mm-bar-fill-hatched" : "mm-bar-fill"}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  href,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="mm-eyebrow">{label}</p>
      <p className="mm-num mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
        {value}
        {unit && <span className="text-base font-normal text-zinc-400">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{note}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-70">
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-zinc-100">{children}</ul>;
}

export function Row({
  left,
  right,
  sub,
}: {
  left: ReactNode;
  right?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-900">{left}</div>
        {sub && <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </li>
  );
}

/**
 * A boxed note. `tone` changes the border and adds a glyph, never the hue —
 * the meaning is carried by the glyph, the border weight and the title.
 */
export function Callout({
  tone = "note",
  title,
  children,
  action,
}: {
  tone?: "note" | "caution" | "strong" | "urgent";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const styles: Record<string, string> = {
    note: "border-zinc-200",
    caution: "border-dashed border-zinc-500",
    strong: "border-zinc-900",
    urgent: "border-2 border-zinc-900 bg-zinc-900 text-white",
  };
  const glyphs: Record<string, string> = { note: "•", caution: "⚠", strong: "■", urgent: "!" };
  const urgent = tone === "urgent";
  return (
    <div className={`rounded-md border p-4 ${styles[tone]} ${urgent ? "" : "bg-zinc-50"}`}>
      <p
        className={`text-sm font-semibold ${urgent ? "text-white" : "text-zinc-900"}`}
      >
        <span aria-hidden className="mr-1.5">
          {glyphs[tone]}
        </span>
        {title}
      </p>
      {children && (
        <div
          className={`mt-1 text-xs leading-relaxed ${urgent ? "text-zinc-200" : "text-zinc-600"}`}
        >
          {children}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="mm-card-flat p-5 text-sm text-zinc-600">{children}</div>;
}

export function ButtonLink({
  href,
  children,
  variant = "solid",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}) {
  const style = variant === "outline" ? "mm-btn mm-btn-outline" : "mm-btn";
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={`${style} ${className ?? ""}`}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={`${style} ${className ?? ""}`}>
      {children}
    </Link>
  );
}

export function LinkRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-800 hover:border-zinc-900"
    >
      {children}
    </Link>
  );
}

/**
 * Deterministic PKR formatting for server-rendered output — no locale
 * surprises, no hydration mismatch between server and client.
 */
export function pkr(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}Rs ${grouped}`;
}