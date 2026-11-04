import { DISCLAIMER } from "../copy";
import { storageNotice } from "../../worker/storage";

export function SecurityPage() {
  return (
    <article className="panel security-page">
      <h1>HTTPS in transit</h1>
      <p>
        HTTPS in transit protects pages and form submissions on DROP Texas. The notes below say what the
        form asks for and what this page does not claim. This is not a government security seal.
      </p>
      <h2>Data minimization for HTTPS in transit pages</h2>
      <p>The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address.</p>
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
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}