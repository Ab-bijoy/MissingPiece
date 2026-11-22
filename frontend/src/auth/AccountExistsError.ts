/** Thrown by signUp when the email already has an account. */
export class AccountExistsError extends Error {
  constructor() {
    super('An account with this email already exists. Try logging in.')
  }
}
