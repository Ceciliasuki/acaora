export const passwordPolicy = {
  minLength: 8,
  maxLength: 72,
  message: "密码需为 8–72 位，并同时包含大写字母、小写字母和数字。",
} as const;

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

export function validatePassword(password: string) {
  return passwordPattern.test(password);
}
