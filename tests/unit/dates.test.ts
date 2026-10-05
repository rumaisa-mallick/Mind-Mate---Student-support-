/**
 * Timezone handling for deadlines.
 *
 * The failure these guard against is quiet and expensive: a student in Lahore
 * sees the wrong closing day, or believes they have eight hours they do not.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  daysUntil,
  describeCountdown,
  deadlineInstant,
  deadlineState,
  formatDeadline,
  formatDeadlineDay,
  formatDeadlineTime,
  localDate,
  pkrInstant,
  todayPK,
} from "../../src/domain/shared/dates.ts";

describe("localDate", () => {
  test("converts an instant into the Pakistan calendar day", () => {
    // 23:30 UTC on the 19th is already 04:30 on the 20th in Karachi.
    assert.equal(localDate(new Date("2026-10-19T23:30:00Z")), "2026-10-20");
  });

  test("the UTC day boundary is not the Pakistani one", () => {
    // 19:00 UTC is exactly midnight in Karachi: the last instant of the 20th
    // is 18:59 UTC. Anything that truncates in UTC slips a day here.
    assert.equal(localDate(new Date("2026-10-20T18:59:00Z")), "2026-10-20");
    assert.equal(localDate(new Date("2026-10-20T19:00:00Z")), "2026-10-21");
  });

  test("an instant before 19:00 UTC is still the same Pakistani day", () => {
    // 04:59 UTC is 09:49 in Karachi, and the rollover is at 19:00 UTC.
    assert.equal(localDate(new Date("2026-10-20T04:59:00Z")), "2026-10-20");
    assert.equal(localDate(new Date("2026-10-20T05:00:00Z")), "2026-10-20");
    assert.equal(localDate(new Date("2026-10-20T04:00:00Z")), "2026-10-20");
  });

  test("respects the zone argument rather than assuming Pakistan", () => {
    // 20:00 UTC on the 19th is 01:00 on the 20th in Karachi, still the 19th in
    // UTC — the two zones genuinely disagree about the day here.
    const instant = new Date("2026-10-19T20:00:00Z");
    assert.equal(localDate(instant, "Asia/Karachi"), "2026-10-20");
    assert.equal(localDate(instant, "UTC"), "2026-10-19");
  });
});

describe("todayPK", () => {
  test("returns a plain calendar date", () => {
    assert.match(todayPK(new Date("2026-10-05T06:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
  });

  test("Pakistan's day rolls over at 19:00 UTC, not at midnight UTC", () => {
    assert.equal(todayPK(new Date("2026-10-05T18:59:00Z")), "2026-10-05");
    assert.equal(todayPK(new Date("2026-10-05T19:00:00Z")), "2026-10-06");
  });
});

describe("daysUntil", () => {
  test("counts calendar days, not leftover hours", () => {
    assert.equal(daysUntil("2026-10-20", "2026-10-05"), 15);
    assert.equal(daysUntil("2026-10-06", "2026-10-05"), 1);
    assert.equal(daysUntil("2026-10-05", "2026-10-05"), 0);
  });

  test("a deadline that closes today reports 0 days, not a fraction", () => {
    // Same instant is on the 21st in Karachi (midnight), so from the 20th it
    // is genuinely one day away. The 16:00 case below is the real boundary.
    assert.equal(daysUntil(new Date("2026-10-20T19:00:00Z"), "2026-10-20"), 1);
    assert.equal(daysUntil(new Date("2026-10-20T11:00:00Z"), "2026-10-20"), 0);
  });

  test("a past deadline is negative", () => {
    assert.equal(daysUntil("2026-03-20", "2026-10-05"), -199);
  });

  test("null is null — never zero, so 'unknown' is not 'closes today'", () => {
    assert.equal(daysUntil(null, "2026-10-05"), null);
  });

  test("unparseable input is null rather than a fabricated number", () => {
    assert.equal(daysUntil("not-a-date", "2026-10-05"), null);
    assert.equal(daysUntil("2026-10-05", "rubbish"), null);
    assert.equal(daysUntil(new Date("nope"), "2026-10-05"), null);
  });

  test("crosses a month and a year boundary", () => {
    assert.equal(daysUntil("2026-11-01", "2026-10-05"), 27);
    assert.equal(daysUntil("2027-01-01", "2026-12-20"), 12);
  });

  test("an ISO instant is placed on its Pakistani day, not its UTC day", () => {
    // 2026-10-19T20:00:00Z is 01:00 on 20 Oct in Karachi, but 19 Oct in UTC.
    // A UTC-based implementation would answer 14 here and show the wrong day.
    assert.equal(daysUntil(new Date("2026-10-19T20:00:00Z"), "2026-10-05"), 15);
    assert.equal(daysUntil(new Date("2026-10-19T20:00:00Z"), "2026-10-05"), 15);
    // And the mirror case: late evening UTC rolls into tomorrow locally.
    assert.equal(daysUntil(new Date("2026-10-20T20:00:00Z"), "2026-10-05"), 16);
  });

  test("consecutive days are exactly one day apart across a whole year", () => {
    // A property check, because a fixed-offset implementation passes spot
    // tests and still slips by a day somewhere near a DST transition.
    const base = "2026-01-01";
    const cursor = new Date(Date.UTC(2026, 0, 1));
    let previous = daysUntil(base, base);
    for (let step = 1; step < 365; step += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const day = cursor.toISOString().slice(0, 10);
      const current = daysUntil(day, base);
      assert.equal(current! - previous!, 1, `drift at ${day}`);
      previous = current;
    }
  });
});

describe("pkrInstant", () => {
  test("turns a published local closing time into the right UTC instant", () => {
    // HEC's stated deadline: 20 Oct 2026, 4:00 PM PKT.
    assert.equal(pkrInstant("2026-10-20", 16, 0)!.toISOString(), "2026-10-20T11:00:00.000Z");
  });

  test("midnight local is 19:00 UTC the previous day", () => {
    assert.equal(pkrInstant("2026-10-20", 0, 0)!.toISOString(), "2026-10-19T19:00:00.000Z");
  });

  test("23:59 local stays inside the same local day", () => {
    assert.equal(pkrInstant("2026-10-20", 23, 59)!.toISOString(), "2026-10-20T18:59:00.000Z");
  });

  test("round-trips: the instant renders back to the wall clock we asked for", () => {
    for (const [date, hour, minute] of [
      ["2026-01-10", 9, 30],
      ["2026-04-10", 16, 0],
      ["2026-07-10", 23, 59],
      ["2026-11-10", 0, 1],
    ] as const) {
      const instant = pkrInstant(date, hour, minute)!;
      assert.equal(formatDeadlineDay(instant), expectedDay(date));
      assert.equal(
        formatDeadline(instant),
        `${expectedDay(date)}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} PKT`,
      );
    }
  });

  test("rejects a malformed date instead of inventing an instant", () => {
    assert.equal(pkrInstant("20-10-2026", 16, 0), null);
    assert.equal(pkrInstant("", 16, 0), null);
  });
});

describe("deadlineInstant", () => {
  test("a bare date resolves to the end of that local day, not UTC midnight", () => {
    // The trap: `new Date("2026-10-20")` is 00:00 **UTC**, which is 05:00 in
    // Karachi. Using it directly closes a date-only deadline five hours early
    // and then reports it closed for the rest of the evening.
    assert.equal(
      deadlineInstant("2026-10-20")!.toISOString(),
      "2026-10-20T18:59:00.000Z", // 23:59 PKT
    );
  });

  test("an offset instant is preserved exactly as published", () => {
    assert.equal(
      deadlineInstant("2026-10-20T16:00:00+05:00")!.toISOString(),
      "2026-10-20T11:00:00.000Z",
    );
  });

  test("a Date passes through untouched", () => {
    const instant = new Date("2026-10-20T11:00:00Z");
    assert.equal(deadlineInstant(instant), instant);
  });

  test("unusable input is null rather than an invented instant", () => {
    assert.equal(deadlineInstant(null), null);
    assert.equal(deadlineInstant(""), null);
    assert.equal(deadlineInstant("   "), null);
    assert.equal(deadlineInstant("not-a-date"), null);
    assert.equal(deadlineInstant(new Date("nope")), null);
  });
});

describe("deadlineState", () => {
  // HEC's Commonwealth deadline: 20 Oct 2026, 16:00 PKT.
  const CLOSE = new Date("2026-10-20T11:00:00Z");

  test("an absent deadline is UNKNOWN, never assumed open", () => {
    assert.deepEqual(deadlineState(null), { status: "UNKNOWN" });
    assert.deepEqual(deadlineState("not-a-date"), { status: "UNKNOWN" });
  });

  test("a deadline that has already passed is CLOSED", () => {
    const now = new Date("2026-10-20T13:00:00Z"); // 18:00 PKT, portal shut
    const state = deadlineState(CLOSE, now);
    assert.equal(state.status, "CLOSED");
  });

  test("closing later today is CLOSING_TODAY with minutes, not '0 days left'", () => {
    const now = new Date("2026-10-20T10:00:00Z"); // 15:00 PKT, one hour left
    const state = deadlineState(CLOSE, now);
    assert.equal(state.status, "CLOSING_TODAY");
    assert.equal(state.status === "CLOSING_TODAY" ? state.minutesLeft : -1, 60);
  });

  test("tomorrow is OPEN with 1 day", () => {
    const state = deadlineState(CLOSE, new Date("2026-10-19T10:00:00Z"));
    assert.deepEqual(state, { status: "OPEN", days: 1 });
  });

  test("a week out is OPEN with 7 days", () => {
    const state = deadlineState(CLOSE, new Date("2026-10-13T10:00:00Z"));
    assert.deepEqual(state, { status: "OPEN", days: 7 });
  });

  test("a date-only deadline stays open all day and closes at 23:59 PKT", () => {
    const at22 = deadlineState("2026-10-05", pkrInstant("2026-10-05", 22, 0)!);
    assert.equal(at22.status, "CLOSING_TODAY");

    const at2359 = deadlineState("2026-10-05", pkrInstant("2026-10-05", 23, 58)!);
    assert.equal(at2359.status, "CLOSING_TODAY");

    const nextDay = deadlineState("2026-10-05", pkrInstant("2026-10-06", 0, 30)!);
    assert.equal(nextDay.status, "CLOSED");
  });

  test("'closes today' and 'already closed' are never conflated", () => {
    const before = deadlineState(CLOSE, new Date("2026-10-20T10:59:00Z"));
    const after = deadlineState(CLOSE, new Date("2026-10-20T11:01:00Z"));
    assert.notEqual(before.status, after.status);
  });
});

describe("describeCountdown", () => {
  test("never claims false precision", () => {
    // "3 days, 4 hours" implies an accuracy the data does not have.
    assert.equal(describeCountdown({ status: "OPEN", days: 3 }), "3 days left");
    assert.equal(describeCountdown({ status: "OPEN", days: 1 }), "1 day left");
  });

  test("a sub-hour window is reported in minutes, not rounded up to hours", () => {
    assert.equal(describeCountdown({ status: "CLOSING_TODAY", minutesLeft: 45 }), "45 min left");
    assert.equal(describeCountdown({ status: "CLOSING_TODAY", minutesLeft: 59 }), "59 min left");
  });

  test("an hour or more is reported in hours", () => {
    assert.equal(describeCountdown({ status: "CLOSING_TODAY", minutesLeft: 60 }), "1 hour left");
    assert.equal(describeCountdown({ status: "CLOSING_TODAY", minutesLeft: 240 }), "4 hours left");
  });

  test("closed deadlines say when, not just that they closed", () => {
    assert.equal(describeCountdown({ status: "CLOSED", days: 0 }), "closed today");
    assert.equal(describeCountdown({ status: "CLOSED", days: -1 }), "closed yesterday");
    assert.equal(describeCountdown({ status: "CLOSED", days: -199 }), "closed 199 days ago");
  });

  test("an unknown deadline never becomes a countdown", () => {
    assert.equal(describeCountdown({ status: "UNKNOWN" }), "no confirmed date");
  });
});

describe("formatDeadlineTime", () => {
  test("returns the published time, or null when none was published", () => {
    assert.equal(formatDeadlineTime("2026-10-20T16:00:00+05:00"), "16:00 PKT");
    assert.equal(formatDeadlineTime("2026-10-20"), null);
    assert.equal(formatDeadlineTime(null), null);
  });
});

describe("formatting", () => {
  test("shows the day and the closing time together", () => {
    assert.equal(formatDeadline(new Date("2026-10-20T11:00:00Z")), "20 Oct 2026, 16:00 PKT");
  });

  test("a null deadline formats to an empty string, never to a guess", () => {
    assert.equal(formatDeadline(null), "");
    assert.equal(formatDeadlineDay(null), "");
    assert.equal(formatDeadline("rubbish"), "");
  });

  test("day-only rendering matches the Pakistan day", () => {
    assert.equal(formatDeadlineDay(new Date("2026-10-19T20:00:00Z")), "20 Oct 2026");
  });

  test("a date-only deadline never shows a time nobody published", () => {
    // Showing 23:59 would present our own fallback as if HEC had confirmed it.
    assert.equal(formatDeadline("2026-10-20"), "20 Oct 2026 (no closing time published)");
    assert.equal(formatDeadlineDay("2026-10-20"), "20 Oct 2026");
  });

  test("a published time is shown in full", () => {
    assert.equal(
      formatDeadline("2026-10-20T16:00:00+05:00"),
      "20 Oct 2026, 16:00 PKT",
    );
  });

  test("pads minutes and hours", () => {
    assert.equal(formatDeadline(new Date("2026-10-20T05:09:00Z")), "20 Oct 2026, 10:09 PKT");
  });
});

/** Expected display form of a plain YYYY-MM-DD, computed independently. */
function expectedDay(date: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [y, m, d] = date.split("-");
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}