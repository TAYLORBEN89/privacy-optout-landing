import { DISCLAIMER } from "../copy";

export function AboutPage() {
  return (
    <article className="panel">
      <h1>About DROP Texas</h1>
      <p>
        DROP Texas is a private, free opt-out service. It helps you ask data brokers not to sell
        your personal information. It is not a government program.
      </p>
      <p>
        A checked Texas box means the Texas Data Privacy and Security Act (TDPSA). An unchecked box
        still uses TDPSA for now and is marked non-Texas.
      </p>
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}