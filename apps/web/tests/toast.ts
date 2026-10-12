/** The one live region every recording act speaks through (ui/Toast.tsx). */
export function toastRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>(".c-toast-region");
  if (!region) throw new Error("No toast region on the page");
  return region;
}

/** The words of the line on screen now, without its action. */
export function toastText(): string {
  return toastRegion().querySelector(".c-toast-text")?.textContent ?? "";
}
