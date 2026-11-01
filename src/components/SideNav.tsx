import { NAV_ITEMS } from "../navItems";
import { AppLink } from "../router";

export function SideNav() {
  return (
    <nav className="sidenav" aria-label="On this site">
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <AppLink href={item.href}>{item.label}</AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
