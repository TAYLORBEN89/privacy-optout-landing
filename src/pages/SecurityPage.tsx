import { TRUST_LABEL } from "../copy";
import { storageNotice } from "../../worker/storage";

export function SecurityPage() {
  return (
    <article className="panel security-page">
      <h1>{TRUST_LABEL}</h1>
      <p className="todo">TODO: replace this placeholder with final security copy before launch.</p>
      <h2>Data minimization</h2>
      <p>The form asks only for your name, mailing address, email, and whether you live in Texas.</p>
      <h2>What is stored</h2>
      <p>
        The design stores only those form fields. {storageNotice()}
      </p>
      <h2>Checks</h2>
      <p>The browser checks the form, and the Worker checks it again before it accepts a request.</p>
      <h2>Encryption in transit</h2>
      <p>Sign-in and form submissions are sent over HTTPS.</p>
      <h2>No selling</h2>
      <p>We do not sell your data.</p>
      <h2>Standards</h2>
      <p>DROP Texas is built to SOC 2 standards. That is not a certification claim.</p>
    </article>
  );
}