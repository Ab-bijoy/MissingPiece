/** Thrown by signUp when the email already has an account. */
export class AccountExistsError extends Error {
  constructor() {
    super('This email is already in use.')
  }
}
