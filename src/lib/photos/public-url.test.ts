// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress, isPublic } from "./public-url.ts";

test("private and special addresses are never fetched", () => {
  for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
    assert.equal(isPrivateAddress(a), true, a);
  }
  for (const a of ["::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:a00:1"])
    assert.equal(isPrivateAddress(a), true, a);
  for (const a of ["8.8.8.8", "::ffff:8.8.8.8", "151.101.1.1", "172.32.0.1", "2606:4700::1111"])
    assert.equal(isPrivateAddress(a), false, a);
});

test("only plain public web links", async () => {
  assert.equal(await isPublic(new URL("http://127.0.0.1/a.jpg")), false);
  assert.equal(await isPublic(new URL("http://[::1]/a.jpg")), false);
  assert.equal(await isPublic(new URL("http://localhost/a.jpg")), false);
  assert.equal(await isPublic(new URL("http://169.254.169.254/latest/meta-data")), false);
  assert.equal(await isPublic(new URL("https://8.8.8.8:8443/a.jpg")), false, "odd ports");
  assert.equal(await isPublic(new URL("https://user:pw@8.8.8.8/a.jpg")), false, "credentials");
  assert.equal(await isPublic(new URL("file:///etc/passwd")), false);
  assert.equal(await isPublic(new URL("https://8.8.8.8/a.jpg")), true);
});
