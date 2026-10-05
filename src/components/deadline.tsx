/**
 * Deadline display.
 *
 * Every deadline in the product is rendered through here, because the rules that
 * make a deadline trustworthy are easy to state and easy to break in three
 * places at once:
 *
 *   1. No date is shown unless one was confirmed on the awarding body's page.
 *   2. The closing *time* is shown, because HEC shuts at 16:00 PKT and a bare
 *      date reads as "any time tomorrow".
 *   3. Times are in Asia/Karachi, not whatever zone the server happens to be in.
 *   4. "Closes later today" and "already closed" are never the same badge.
 *
 * `readDeadline` is exported so a page can classify once and then choose its own
 * wording, rather than re-deriving the state and getting a different answer.
 */

import {
  deadlineState,
  describeCountdown,
  formatDeadline,
  formatDeadlineTime,
  type DeadlineState,
} from "@/domain/shared/dates";
import { Badge } from "@/components/ui";

export interface DeadlineBadgeProps {
  deadline: Date | null;
  /** What to say when there is no confirmed date. Never a date. */
  unknownLabel?: string;
  /** Warn at or below this many days out. */
  warnWithinDays?: number;
}

/** Classifies a deadline once so callers do not each re-derive the state. */
export function readDeadline(deadline: Date | null, now: Date = new Date()): DeadlineState {
  return deadlineState(deadline, now);
}

export function DeadlineBadge({
  deadline,
  unknownLabel = "no confirmed date",
  warnWithinDays = 21,
}: DeadlineBadgeProps) {
  const state = deadlineState(deadline, new Date());
  const time = formatDeadlineTime(deadline);
  const countdown = describeCountdown(state);

  switch (state.status) {
    case "UNKNOWN":
      // Deliberately says nothing about a date it cannot verify.
      return (
        <Badge variant="dotted" title="We have not confirmed a date on the awarding body's own page.">
          <span aria-hidden>⚠</span> {unknownLabel}
        </Badge>
      );

    case "CLOSED":
      return (
        <Badge variant="muted" title={`Closed ${formatDeadline(deadline)}.`}>
          <span aria-hidden>✕</span> {countdown}
        </Badge>
      );

    case "CLOSING_TODAY":
      // Solid fill: this is the one case where the student still has a chance,
      // and the urgency is real rather than manufactured.
      return (
        <Badge variant="solid" title={`Applications close ${formatDeadline(deadline)}.`}>
          {countdown}
          {time ? ` · closes ${time}` : ""}
        </Badge>
      );

    case "OPEN": {
      const urgent = state.days <= warnWithinDays;
      return (
        <Badge
          variant={urgent ? "solid" : "outline"}
          title={`Applications close ${formatDeadline(deadline)}.`}
        >
          {countdown}
          {time ? ` · ${time}` : ""}
        </Badge>
      );
    }
  }
}

/** One-line prose form for callouts and detail blocks. */
export function DeadlineSentence({ deadline }: { deadline: Date | null }) {
  const state = deadlineState(deadline, new Date());

  if (state.status === "UNKNOWN") {
    return (
      <>
        No deadline is confirmed for this cycle. The awarding body either sets it locally through
        your university, or has not published it. Neither is a reason to guess — check the official
        page.
      </>
    );
  }

  return (
    <>
      Applications close{" "}
      <strong className="text-zinc-900">{formatDeadline(deadline)}</strong> —{" "}
      {describeCountdown(state)}.
    </>
  );
}