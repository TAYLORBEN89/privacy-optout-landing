export type MenuEvent = "toggle" | "escape" | "navigate" | "backdrop";

export function nextMenuOpen(open: boolean, event: MenuEvent): boolean {
  if (event === "toggle") return !open;
  return false;
}
