/// <reference types="jest" />

// `expo/tsconfig.base` leaves `types` unset, and TypeScript's automatic @types discovery
// does not surface the Jest globals here, so `describe`/`it`/`expect` are referenced
// explicitly. Scoped to a declaration file so the app's own type resolution is untouched.
