import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalJson,
  isLocalOrPrivateHostname,
  sha256Hex,
  summarizeCredential,
  verifyCredentialBytes,
} from "../src/lib/credential.ts";

const encode = (value: string) => new TextEncoder().encode(value);

test("canonical JSON is stable across object key order", () => {
  assert.equal(
    canonicalJson({ z: [3, { b: true, a: null }], a: "value" }),
    '{"a":"value","z":[3,{"a":null,"b":true}]}',
  );
});

test("credential verification accepts an exact byte anchor", async () => {
  const source = encode('{"type":["VerifiableCredential"],"credentialSubject":{"name":"Sam"}}');
  const anchor = await sha256Hex(source);
  const result = await verifyCredentialBytes(source, anchor);

  assert.equal(result.matches, true);
  assert.equal(result.matchedRepresentation, "raw");
  assert.equal(result.summary?.subjectName, "Sam");
});

test("credential verification supports the issuer canonical representation", async () => {
  const source = encode('{"b":2,"a":1}');
  const anchor = await sha256Hex(encode('{"a":1,"b":2}'));
  const result = await verifyCredentialBytes(source, anchor);

  assert.equal(result.matches, true);
  assert.equal(result.matchedRepresentation, "canonical");
});

test("a different document never inherits the anchored identity", async () => {
  const anchor = await sha256Hex(encode('{"credentialSubject":{"name":"Alice"}}'));
  const result = await verifyCredentialBytes(
    encode('{"credentialSubject":{"name":"Mallory"}}'),
    anchor,
  );

  assert.equal(result.matches, false);
  assert.equal(result.matchedRepresentation, null);
});

test("W3C VC 2.0 summaries expose only deliberately disclosed fields", () => {
  const summary = summarizeCredential({
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "RecruiterCredential"],
    issuer: { id: "did:web:issuer.example" },
    credentialSubject: { name: "Recruiter Name", secretEvidence: "not rendered" },
    validUntil: "2027-08-10T00:00:00Z",
    proof: { type: "DataIntegrityProof" },
  });

  assert.equal(summary?.w3cVc2, true);
  assert.equal(summary?.issuer, "did:web:issuer.example");
  assert.equal(summary?.subjectName, "Recruiter Name");
  assert.equal(summary?.proofPresent, true);
});

test("credential fetching rejects local and private address literals", () => {
  for (const value of [
    "localhost",
    "127.0.0.1",
    "10.2.3.4",
    "172.20.1.2",
    "192.168.1.1",
    "[::]",
    "[::1]",
    "[::ffff:7f00:1]",
    "[fd12::1]",
    "[fe90::1]",
  ]) {
    assert.equal(isLocalOrPrivateHostname(value), true, value);
  }
  assert.equal(isLocalOrPrivateHostname("credentials.example"), false);
  assert.equal(isLocalOrPrivateHostname("8.8.8.8"), false);
  assert.equal(isLocalOrPrivateHostname("[2001:4860:4860::8888]"), false);
});
