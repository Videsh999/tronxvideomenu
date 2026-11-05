import assert from "node:assert/strict";
import test from "node:test";
import { restaurantWifiUpdateSchema } from "../lib/validations/index";
import {
  getWifiCustomerDetails,
  isWifiConfiguredForGuests,
  resolveWifiConfigurationUpdate,
} from "../lib/wifi-configuration";
import type { RestaurantWifiConfiguration } from "../types/index";

const storedPassword: RestaurantWifiConfiguration = {
  ssid: "Cafe Wi-Fi",
  security: "WPA2",
  passwordCiphertext: "encrypted-value",
  passwordIv: "test-iv",
  passwordAuthTag: "test-tag",
};

const encryptForTest = (password: string) => ({
  passwordCiphertext: `encrypted:${password}`,
  passwordIv: "test-iv",
  passwordAuthTag: "test-tag",
});

test("clearing with an empty password accepts the request and removes saved credentials", () => {
  const parsed = restaurantWifiUpdateSchema.safeParse({
    ssid: "Cafe Wi-Fi",
    security: "WPA2",
    password: "",
    clearPassword: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const result = resolveWifiConfigurationUpdate(storedPassword, parsed.data, () => {
    throw new Error("must not encrypt an empty password");
  });
  assert.deepEqual(result, { ssid: "Cafe Wi-Fi", security: "WPA2" });
});

test("clearing with password omitted removes saved credentials", () => {
  const parsed = restaurantWifiUpdateSchema.safeParse({
    ssid: "Cafe Wi-Fi",
    security: "WPA2",
    clearPassword: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(
    resolveWifiConfigurationUpdate(storedPassword, parsed.data, encryptForTest),
    { ssid: "Cafe Wi-Fi", security: "WPA2" },
  );
});

test("a new secured-network password is encrypted and saved", () => {
  const parsed = restaurantWifiUpdateSchema.safeParse({
    ssid: "Cafe Wi-Fi",
    security: "WPA3",
    password: "correct horse",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(
    resolveWifiConfigurationUpdate(undefined, parsed.data, encryptForTest),
    {
      ssid: "Cafe Wi-Fi",
      security: "WPA3",
      ...encryptForTest("correct horse"),
    },
  );
});

test("blank password without clearPassword is treated as omitted and preserves the saved password", () => {
  const parsed = restaurantWifiUpdateSchema.safeParse({
    ssid: "Cafe Wi-Fi",
    security: "WPA2",
    password: "   ",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(
    resolveWifiConfigurationUpdate(storedPassword, parsed.data, encryptForTest),
    { ...storedPassword, ssid: "Cafe Wi-Fi" },
  );
});

test("OPEN networks never retain or encrypt a password", () => {
  assert.deepEqual(
    resolveWifiConfigurationUpdate(storedPassword, {
      ssid: "Cafe Guest",
      security: "OPEN",
      password: "",
      clearPassword: false,
    }, () => {
      throw new Error("must not encrypt an OPEN network password");
    }),
    { ssid: "Cafe Guest", security: "OPEN" },
  );
});

test("an omitted password preserves existing encrypted credentials", () => {
  assert.deepEqual(
    resolveWifiConfigurationUpdate(storedPassword, {
      ssid: "Cafe Wi-Fi Updated",
      security: "WPA3",
      clearPassword: false,
    }, encryptForTest),
    { ...storedPassword, ssid: "Cafe Wi-Fi Updated", security: "WPA3" },
  );
});

test("secured Wi-Fi without a saved or new password keeps the existing validation error", () => {
  assert.throws(
    () => resolveWifiConfigurationUpdate(undefined, {
      ssid: "Cafe Wi-Fi",
      security: "WPA2",
      clearPassword: false,
    }, encryptForTest),
    { message: "Enter a password for this secured Wi-Fi network." },
  );
});

test("guest Wi-Fi control stays hidden until an SSID is saved", () => {
  assert.equal(isWifiConfiguredForGuests(undefined), false);
  assert.equal(isWifiConfiguredForGuests({ ssid: "   ", security: "OPEN" }), false);
  assert.equal(isWifiConfiguredForGuests({ ssid: "Cafe Guest", security: "OPEN" }), true);
  assert.equal(getWifiCustomerDetails({ ssid: "  ", security: "OPEN" }, () => ""), null);
});

test("public Wi-Fi details omit a password when none is configured", () => {
  assert.deepEqual(
    getWifiCustomerDetails({ ssid: "Cafe Guest", security: "WPA2" }, () => {
      throw new Error("must not decrypt a missing password");
    }),
    { ssid: "Cafe Guest", security: "WPA2" },
  );
});

test("public Wi-Fi details include the decrypted configured password", () => {
  assert.deepEqual(
    getWifiCustomerDetails(storedPassword, () => "customer-password"),
    { ssid: "Cafe Wi-Fi", security: "WPA2", password: "customer-password" },
  );
});
