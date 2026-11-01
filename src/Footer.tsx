import { useState } from "react";
import { Wordmark } from "./Brand";
import { DISCLAIMER } from "./copy";
import { FOOTER_COPYRIGHT, FOOTER_DESKTOP_ROWS, FOOTER_GROUPS, type FooterLink } from "./footerLinks";
import { AppLink } from "./router";

function FooterAnchor({ link }: { link: FooterLink }) {
  if (link.href.startsWith("/")) {
    return <AppLink href={link.href}>{link.label}</AppLink>;
  }
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      {link.label}
    </a>
  );
}

function FooterGroup({ id, title, links }: { id: string; title: string; links: readonly FooterLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = `footer-panel-${id}`;
  return (
    <div className="footer-group">
      <button
        type="button"
        className="footer-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
      </button>
      <div id={panelId} className="footer-panel" hidden={!open}>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <FooterAnchor link={link} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-light">
        <div className="footer-accordion">
          {FOOTER_GROUPS.map((group) => (
            <FooterGroup key={group.id} id={group.id} title={group.title} links={group.links} />
          ))}
        </div>
        <nav className="footer-rows" aria-label="Footer">
          {FOOTER_DESKTOP_ROWS.map((row) => (
            <p key={row[0]?.href} className="footer-row">
              {row.map((link, index) => (
                <span key={link.href} className="footer-row-item">
                  {index > 0 ? <span className="footer-pipe" aria-hidden="true">|</span> : null}
                  <FooterAnchor link={link} />
                </span>
              ))}
            </p>
          ))}
        </nav>
      </div>
      <div className="footer-dark">
        <Wordmark />
        <p className="footer-copy">{FOOTER_COPYRIGHT}</p>
        <p className="independence">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
