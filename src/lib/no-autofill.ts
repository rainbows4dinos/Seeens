// Spread on text fields that aren't sign-in. Password managers ignore
// autocomplete="off", so each one needs its own opt-out: 1Password,
// LastPass, Bitwarden, and Dashlane, in that order.
export const noAutofill = {
  autoComplete: "off",
  "data-1p-ignore": "",
  "data-lpignore": "true",
  "data-bwignore": "",
  "data-form-type": "other",
} as const;
