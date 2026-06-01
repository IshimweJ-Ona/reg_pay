const fallbackMessages: Record<string, string> = {
  "role_id must be a numeric id.": "Please choose a valid role before saving.",
  "working_location_id must be a uuid or numeric id.": "Please choose a branch.",
  "department_id must be a uuid or numeric id.": "Please choose a department.",
};

export function userFriendlyError(error: any, fallback = "Something went wrong. Please try again.") {
  const raw = error?.response?.data?.message;
  const message = Array.isArray(raw) ? raw[0] : raw;

  if (!message || typeof message !== "string") return fallback;

  return fallbackMessages[message] ?? message
    .replaceAll("_", " ")
    .replace(/\bid\b/gi, "selection")
    .replace(/\buuid\b/gi, "selection");
}
