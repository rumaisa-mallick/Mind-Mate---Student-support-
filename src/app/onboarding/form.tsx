"use client";

/**
 * Onboarding questionnaire.
 *
 * Client component only because it uses `useActionState` for inline
 * validation. Everything is a plain `<form>` posting to a server action, so it
 * still works with JavaScript disabled — the action is what persists data.
 *
 * Grouped into five numbered steps because "more questions" only helps if the
 * questions are findable. Each step says what it will change.
 */

import { useActionState } from "react";

import { savePersonalisation, type OnboardingState } from "./actions";

const GOALS = [
  { value: "FINANCE", label: "Pay for my studies", hint: "fees, rent, food, the gap at the end of the month" },
  { value: "ACADEMIC", label: "Do better academically", hint: "grades, results, not falling behind" },
  { value: "CAREER", label: "Prepare for a career", hint: "internships, CV, what comes after graduation" },
  { value: "WELLBEING", label: "Feel steadier", hint: "stress, sleep, having people to talk to" },
] as const;

const SUPPORT = [
  { value: "SELF_GUIDED", label: "Reading and exercises first", hint: "I want to try things myself before speaking to anyone" },
  { value: "PEER", label: "Other students first", hint: "societies and peer groups work better for me" },
  { value: "PROFESSIONAL", label: "Counsellor or advisor first", hint: "put the official services at the top" },
] as const;

const STYLES = [
  { value: "INTENSIVE", label: "Few long blocks", hint: "two or three deep sessions a week" },
  { value: "STEADY", label: "A steady rhythm", hint: "an hour or so, most days" },
  { value: "SPACED", label: "Short sessions spread out", hint: "30–40 minutes, several times a day" },
] as const;

const WORK = [
  { value: "NONE", label: "No paid work", hint: "study is my main commitment" },
  { value: "PART_TIME", label: "Part time", hint: "a few hours a week, or irregular work" },
  { value: "FULL_TIME", label: "Full time", hint: "work takes most of my week" },
] as const;

const TONES = [
  { value: "DIRECT", label: "Straight to the point", hint: "short sentences, no preamble" },
  { value: "GENTLE", label: "Gentle", hint: "softer wording, more reassurance" },
  { value: "DETAILED", label: "Show me everything", hint: "full reasoning, tables, all the caveats" },
] as const;

const TRIGGERS = [
  { value: "MONEY", label: "Money" },
  { value: "EXAMS", label: "Exams" },
  { value: "ASSIGNMENT", label: "Assignments" },
  { value: "CAREER", label: "My future" },
  { value: "FAMILY", label: "Family expectations" },
  { value: "RELATIONSHIPS", label: "Relationships" },
  { value: "LONELINESS", label: "Feeling alone" },
  { value: "SLEEP", label: "Sleep" },
  { value: "HEALTH", label: "My health" },
  { value: "HOUSING", label: "Where I live" },
  { value: "TRANSPORT", label: "Getting to campus" },
] as const;

type Choice = { value: string; label: string; hint?: string };

function Fieldset({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mm-card p-5">
      <legend className="mm-eyebrow px-1">Step {step}</legend>
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </fieldset>
  );
}

function ChoiceGroup({
  name,
  legend,
  hint,
  options,
  defaultValue,
  type,
  error,
  max,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: readonly Choice[];
  /** Radio: the selected code. Checkbox: the codes that should start ticked. */
  defaultValue?: string | string[] | null;
  type: "radio" | "checkbox";
  error?: string;
  max?: number;
}) {
  const selected = Array.isArray(defaultValue) ? defaultValue : [];
  return (
    <div>
      <p className="text-sm font-medium text-zinc-900">
        {legend}
        {type === "checkbox" && max ? (
          <span className="ml-2 text-xs font-normal text-zinc-500">pick up to {max}</span>
        ) : null}
      </p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="mm-choice items-start">
            <input
              type={type}
              name={name}
              value={option.value}
              defaultChecked={
                type === "radio" ? defaultValue === option.value : selected.includes(option.value)
              }
              className="mt-0.5"
            />
            <span>
              <span className="block">{option.label}</span>
              {option.hint && (
                <span className="block text-xs text-zinc-500">{option.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs font-medium text-zinc-900">⚠ {error}</p>
      )}
    </div>
  );
}

export function OnboardingForm({
  email,
  defaults,
}: {
  email: string;
  defaults: {
    primaryGoal: string | null;
    secondaryGoals: string[];
    stressTriggers: string[];
    supportPreference: string | null;
    availableHoursPerWeek: number | null;
    studyStyle: string | null;
    commuteMinutes: number | null;
    workCommitment: string | null;
    caresForOthers: boolean;
    tonePreference: string | null;
    preferredLanguage: string;
  };
}) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    savePersonalisation,
    { status: "idle" },
  );

  const issues = state.issues ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />

      <Fieldset
        step={1}
        title="What matters most right now?"
        description="This decides what leads your dashboard. It never changes whether you qualify for anything — that is decided by published rules, not preferences."
      >
        <ChoiceGroup
          type="radio"
          name="primaryGoal"
          legend="Pick one"
          options={GOALS}
          defaultValue={defaults.primaryGoal ?? "FINANCE"}
          error={issues.primaryGoal}
        />
        <ChoiceGroup
          type="checkbox"
          name="secondaryGoals"
          legend="Also important (optional)"
          options={GOALS}
          defaultValue={defaults.secondaryGoals}
          max={3}
          error={issues.secondaryGoals}
        />
      </Fieldset>

      <Fieldset
        step={2}
        title="What is weighing on you?"
        description="Be blunt. These are labels only — they never leave your account, and they are not used to decide eligibility."
      >
        <ChoiceGroup
          type="checkbox"
          name="stressTriggers"
          legend="Anything that regularly costs you energy"
          options={TRIGGERS}
          defaultValue={defaults.stressTriggers}
          max={6}
          error={issues.stressTriggers}
        />
      </Fieldset>

      <Fieldset
        step={3}
        title="Your week, as it really is"
        description="We plan around the time you actually have, not the time a brochure assumes. Work, travel and caring for other people are all counted before study time."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hours" className="text-sm font-medium text-zinc-900">
              Hours a week genuinely free for study
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">
              Be conservative. An over-estimate produces a plan you will abandon.
            </p>
            <input
              id="hours"
              name="availableHoursPerWeek"
              type="number"
              min={1}
              max={80}
              defaultValue={defaults.availableHoursPerWeek ?? 20}
              className="mm-input mt-2"
            />
            {issues.availableHoursPerWeek && (
              <p className="mt-1 text-xs font-medium">⚠ {issues.availableHoursPerWeek}</p>
            )}
          </div>
          <div>
            <label htmlFor="commute" className="text-sm font-medium text-zinc-900">
              Minutes travelling per week
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">To campus and back, across a normal week.</p>
            <input
              id="commute"
              name="commuteMinutes"
              type="number"
              min={0}
              max={240}
              defaultValue={defaults.commuteMinutes ?? 60}
              className="mm-input mt-2"
            />
            {issues.commuteMinutes && (
              <p className="mt-1 text-xs font-medium">⚠ {issues.commuteMinutes}</p>
            )}
          </div>
        </div>

        <ChoiceGroup
          type="radio"
          name="studyStyle"
          legend="How do you actually study?"
          options={STYLES}
          defaultValue={defaults.studyStyle ?? "STEADY"}
          error={issues.studyStyle}
        />
        <ChoiceGroup
          type="radio"
          name="workCommitment"
          legend="Paid work"
          options={WORK}
          defaultValue={defaults.workCommitment ?? "NONE"}
          error={issues.workCommitment}
        />

        <label className="mm-choice items-start">
          <input
            type="checkbox"
            name="caresForOthers"
            defaultChecked={defaults.caresForOthers}
            className="mt-0.5"
          />
          <span>
            <span className="block">I look after other people</span>
            <span className="block text-xs text-zinc-500">
              siblings, an unwell parent, relatives. We reserve time for this before planning study.
            </span>
          </span>
        </label>
      </Fieldset>

      <Fieldset
        step={4}
        title="If you need support, how do you want to be pointed at it?"
        description="You can change this at any time, and nothing here affects your funding matches."
      >
        <ChoiceGroup
          type="radio"
          name="supportPreference"
          legend="Preferred route"
          options={SUPPORT}
          defaultValue={defaults.supportPreference ?? "SELF_GUIDED"}
          error={issues.supportPreference}
        />
      </Fieldset>

      <Fieldset
        step={5}
        title="How should this talk to you?"
        description="Purely presentational. It changes wording and depth, never results."
      >
        <ChoiceGroup
          type="radio"
          name="tonePreference"
          legend="Tone and depth"
          options={TONES}
          defaultValue={defaults.tonePreference ?? "DIRECT"}
          error={issues.tonePreference}
        />
        <ChoiceGroup
          type="radio"
          name="preferredLanguage"
          legend="Language"
          options={[
            { value: "en", label: "English" },
            { value: "ur", label: "اردو", hint: "Urdu — partial support today" },
          ]}
          defaultValue={defaults.preferredLanguage}
          error={issues.preferredLanguage}
        />
      </Fieldset>

      {state.status === "error" && (
        <p className="mm-card-flat p-4 text-sm font-medium text-zinc-900">
          ⚠ {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="mm-card-flat border-l-4 border-l-zinc-900 p-4 text-sm font-medium text-zinc-900">
          ✓ {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="mm-btn" disabled={pending}>
          {pending ? "Saving…" : "Save my answers"}
        </button>
        <p className="text-xs text-zinc-500">
          Nothing here asks for documents, a bank statement, or proof of income.
        </p>
      </div>
    </form>
  );
}