export function formatDateTime(value: string | null) {
  if (!value) {
    return "Date to be confirmed";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRound(value: string | null) {
  if (!value) {
    return "Group stage";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
