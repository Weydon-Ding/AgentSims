/**
 * Negative fixture: Intentional type errors for testing the test harness.
 * This file should NOT compile successfully.
 */

// Deliberate type error: assigning string to number
const intentionalError: number = "this should be a number";

// Deliberate type error: calling non-existent method
const arr: number[] = [1, 2, 3];
// @ts-expect-error - This is intentionally wrong for testing
arr.nonExistentMethod();

// Deliberate type error: accessing property on undefined
const maybeUndefined: { value: string } | undefined = undefined;
// @ts-expect-error - This is intentionally wrong for testing
const val = maybeUndefined.value;

export { intentionalError };
