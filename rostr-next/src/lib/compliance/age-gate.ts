/**
 * COPPA / age-gate helpers.
 *
 * Rostr does not knowingly collect or process data on users under 13.
 * The hard floor is enforced at three layers:
 *
 *   1. Database (migration 40) — players_grade_age_floor CHECK
 *      constraint requires grade IS NULL OR grade >= 9 on new inserts.
 *   2. Server actions — addPlayerAction, importRosterAction, signup
 *      flow all call assertGradeMeetsAgeFloor() before persisting.
 *   3. UI — grade pickers default to grade 9 minimum; add-player form
 *      validates client-side to prevent the round-trip.
 *
 * If we ever decide to support under-13, we'd lift this floor AND
 * add the COPPA-compliant verifiable parental consent (VPC)
 * infrastructure: Email Plus (delayed second confirmation), credit
 * card verification, or government ID check. The current
 * email-only consent flow is NOT VPC-compliant for under-13 users —
 * that's why the hard floor exists.
 */

/** Minimum grade Rostr will collect data for. 9 = high school freshman, presumed age 14. */
export const MINIMUM_GRADE = 9;

/** Maximum grade Rostr operates with (12th grade is the senior year cutoff). */
export const MAXIMUM_GRADE = 12;

/**
 * Birth-year threshold (computed at call time so this is correct
 * across calendar years). Returns the earliest birth year that's
 * still considered under 13 — anyone born in or after this year is
 * presumed under 13 and CANNOT be added to Rostr.
 */
export function under13BirthYearThreshold(today: Date = new Date()): number {
  return today.getFullYear() - 13;
}

/**
 * True when the proposed grade meets Rostr's age floor.
 *   grade < MINIMUM_GRADE → false (under 13 likely; reject)
 *   grade > MAXIMUM_GRADE → false (out of HS scope; reject)
 *   null/undefined → true (allowed; coach can omit grade for adult/post-grad players)
 */
export function gradeMeetsAgeFloor(grade: number | null | undefined): boolean {
  if (grade == null) return true;
  return grade >= MINIMUM_GRADE && grade <= MAXIMUM_GRADE;
}

/**
 * Throwing variant for server-action callsites. Throws an Error with
 * a user-friendly message; actions catch + return as { error }.
 */
export class AgeFloorViolation extends Error {
  constructor(grade: number | null | undefined) {
    super(
      `Rostr does not collect data for users under 13. Grade must be ${MINIMUM_GRADE}–${MAXIMUM_GRADE} (or omitted for adult athletes). Provided: ${grade}.`,
    );
    this.name = "AgeFloorViolation";
  }
}

export function assertGradeMeetsAgeFloor(grade: number | null | undefined): void {
  if (!gradeMeetsAgeFloor(grade)) {
    throw new AgeFloorViolation(grade);
  }
}

/**
 * Birth-year-based age check. Used when a coach optionally provides
 * birth_year on a player row. If birth_year would imply under-13,
 * reject the value.
 */
export function birthYearMeetsAgeFloor(
  birthYear: number | null | undefined,
  today: Date = new Date(),
): boolean {
  if (birthYear == null) return true;
  const minBirthYear = under13BirthYearThreshold(today);
  return birthYear < minBirthYear;
}

export function assertBirthYearMeetsAgeFloor(
  birthYear: number | null | undefined,
  today: Date = new Date(),
): void {
  if (!birthYearMeetsAgeFloor(birthYear, today)) {
    throw new AgeFloorViolation(null);
  }
}
