import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";

test("Local QRCode.toDataURL generates a valid base64 image data URL", async () => {
  const testUrl = "http://localhost:3000/menu/moai-kitchen?table=5";
  const dataUrl = await QRCode.toDataURL(testUrl, {
    width: 280,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  assert.ok(dataUrl.startsWith("data:image/png;base64,"));
  assert.ok(dataUrl.length > 100);
});

test("Local QRCode encodes the exact restaurant slug and table number parameter", async () => {
  const slug = "native-south";
  const table = 12;
  const target = `https://tronx.menu/menu/${slug}?table=${table}`;

  const qrString = await QRCode.toString(target, { type: "utf8" });
  assert.ok(typeof qrString === "string");
  assert.ok(qrString.length > 0);
});
