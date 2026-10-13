import { FieldTree, ValidationError } from '@angular/forms/signals';
import { apiError, describeError } from '../../core/http/api-error';

export interface ServerErrorOptions {
  /**
   * Field labels: the gateway's field messages are fragments ("is incorrect"), read as
   * "Current password is incorrect" under the field.
   */
  labels?: Partial<Record<string, string>>;
  /** The sentence for an error that isn't about one field. */
  describe?: (error: unknown) => string;
}

/**
 * Turns a failed submit into Signal Forms errors: each of the gateway's field errors goes on the field it
 * names (the JSON property, e.g. "newPassword"); anything else becomes one error on the whole form. Return
 * the result from the submit action.
 */
export function serverErrors<T>(
  form: FieldTree<T>,
  error: unknown,
  options: ServerErrorOptions = {},
): ValidationError.WithOptionalFieldTree[] {
  const fields = form as unknown as Partial<Record<string, FieldTree<unknown>>>;
  const errors: ValidationError.WithOptionalFieldTree[] = [];
  for (const fieldError of apiError(error)?.errors ?? []) {
    const target = fieldError.field ? fields[fieldError.field] : undefined;
    if (!target || !fieldError.field) continue;
    const label = options.labels?.[fieldError.field];
    errors.push({
      kind: 'server',
      message: label ? `${label} ${fieldError.message}` : fieldError.message,
      fieldTree: target,
    });
  }
  if (errors.length > 0) return errors;
  return [{ kind: 'server', message: (options.describe ?? describeError)(error), fieldTree: form }];
}

/** The first error message to show under a field, once the user has been there or tried to submit. */
export function firstError(field: FieldTree<unknown>): string | null {
  const state = field();
  if (!state.touched()) return null;
  return state.errors()[0]?.message ?? null;
}
