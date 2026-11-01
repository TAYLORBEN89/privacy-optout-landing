import { NAV_ITEMS } from "../navItems";
import { AppLink } from "../router";

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="On this site">
      <ul className="mobile-nav-track">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <AppLink href={item.href}>{item.label}</AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
