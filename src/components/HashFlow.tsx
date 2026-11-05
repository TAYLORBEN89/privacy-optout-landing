/** The numbered hash steps. Shared by /texas-proposal and /for-brokers so the wording stays identical. */
export function HashFlow() {
  return (
    <ol className="hash-flow">
      <li>
        <span className="hash-badge" aria-hidden="true">
          1
        </span>
        <h3>Standardize the identifiers</h3>
        <p>
          Names are lowercased. Hyphens, apostrophes, spaces, and other marks come off. Accented
          letters are changed to a plain letter, not dropped. The regulation's example turns
          Björn O'Connor-López into bjornoconnorlopez. A two-word first name stays one piece, so
          Juan Pablo becomes juanpablo. Email is lowercased and spaces are removed. Dots and plus
          signs stay.
        </p>
        <p>
          A date of birth becomes eight digits, year then month then day. January 12, 1990
          becomes 19900112. A ZIP code uses its first five characters. 95811-6213 becomes 95811.
          The technical guide also drops characters that are not letters or digits, removes
          leading zeros, and uses lowercase, so 00712345 becomes 71234. A phone number keeps the
          last 10 digits. The regulation's example turns +1(987) 765-4321 into 9877654321. If
          fewer than 10 digits remain, the technical guide keeps all of them.
        </p>
      </li>
      <li>
        <span className="hash-badge" aria-hidden="true">
          2
        </span>
        <h3>Hash with SHA-256</h3>
        <p>
          Each standardized value is hashed with SHA-256. The input is UTF-8 text. The output is
          Base64. The regulation tells a broker to use the hashing algorithm named on the list.
          The technical guide names SHA-256, UTF-8 input, and Base64 output.
        </p>
      </li>
      <li>
        <span className="hash-badge" aria-hidden="true">
          3
        </span>
        <h3>Hash a combination again</h3>
        <p>
          A single field, such as email or phone, is one hash. A multi-field list is different.
          First name, last name, date of birth, and ZIP are each hashed on their own. Those
          hashes are joined in that order, with nothing added between them. The joined string is
          hashed again. First name, last name, and a vehicle identification number follow the
          same two-step hash.
        </p>
      </li>
      <li>
        <span className="hash-badge" aria-hidden="true">
          4
        </span>
        <h3>The broker matches its own records</h3>
        <p>
          The broker hashes its own records the same way and compares those hashes with the list.
          The platform does not give the broker the raw identifiers. There is no download of the
          raw values.
        </p>
      </li>
      <li>
        <span className="hash-badge" aria-hidden="true">
          5
        </span>
        <h3>The broker reports a status</h3>
        <p>
          The regulation names four responses. Record exempted means a match, but the information
          is exempt, so nothing is deleted. Record deleted means a match and the non-exempt
          information was deleted. Record opted out of sale is not a general opt-out. It is used
          when more than one person matches the same identifier, and the broker opted all of them
          out of sale or sharing. Record not found means no match. The technical guide uses
          number codes for those same ideas: 2 Exempted, 3 Deleted, 4 Opted out, and 5 Not found.
        </p>
      </li>
    </ol>
  );
}
