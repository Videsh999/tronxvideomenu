import assert from "node:assert/strict";
import test from "node:test";
import {
  restaurantAdminProfileSchema,
  updateRestaurantSchema,
} from "../lib/validations/index";

test("restaurantAdminProfileSchema successfully parses a valid Restaurant Admin profile payload", () => {
  const validPayload = {
    name: "The Grand Bistro",
    logoUrl: "https://example.com/logo.png",
    coverUrl: "https://example.com/cover.jpg",
    logo: "https://example.com/logo.png",
    coverImage: "https://example.com/cover.jpg",
    description: "Authentic fine dining experience",
    tagline: "Taste the extraordinary",
    phone: "+91 98765 43210",
    email: "contact@grandbistro.com",
    address: "123 Main Street, Bangalore",
    openingHours: "11:00 AM - 11:00 PM",
    currency: "INR",
    isOpen: true,
    socialLinks: {
      instagram: "https://instagram.com/grandbistro",
      facebook: "https://facebook.com/grandbistro",
      twitter: "",
      website: "https://grandbistro.com",
    },
  };

  const parsed = restaurantAdminProfileSchema.parse(validPayload);
  assert.equal(parsed.name, "The Grand Bistro");
  assert.equal(parsed.currency, "INR");
  assert.equal(parsed.isOpen, true);
  assert.equal(parsed.socialLinks?.instagram, "https://instagram.com/grandbistro");
});

test("restaurantAdminProfileSchema rejects theme modification", () => {
  const payloadWithTheme = {
    name: "The Grand Bistro",
    theme: {
      primaryColor: "#123456",
      secondaryColor: "#654321",
    },
  };

  assert.throws(
    () => restaurantAdminProfileSchema.parse(payloadWithTheme),
    (error: unknown) => {
      assert(error && typeof error === "object" && "issues" in error);
      const issues = (error as { issues: Array<{ code: string; message: string }> }).issues;
      return issues.some(
        (issue) =>
          issue.code === "unrecognized_keys" ||
          issue.message.toLowerCase().includes("theme") ||
          issue.message.toLowerCase().includes("unrecognized"),
      );
    },
  );
});

test("restaurantAdminProfileSchema rejects slug, isActive, and subscription restricted fields", () => {
  const restrictedFields = [
    { slug: "new-slug" },
    { isActive: false },
    { subscriptionPlan: "ENTERPRISE" },
    { subscriptionStatus: "ACTIVE" },
    { subscriptionEnabled: true },
    { featureOverrides: { CUSTOM_THEME: true } },
  ];

  for (const field of restrictedFields) {
    const payload = {
      name: "The Grand Bistro",
      ...field,
    };

    assert.throws(
      () => restaurantAdminProfileSchema.parse(payload),
      (error: unknown) => {
        assert(error && typeof error === "object" && "issues" in error);
        return true;
      },
      `Expected restaurantAdminProfileSchema to reject ${Object.keys(field)[0]}`,
    );
  }
});

test("updateRestaurantSchema accepts valid theme updates for Super Admin", () => {
  const superAdminThemePayload = {
    theme: {
      primaryColor: "#602e31",
      secondaryColor: "#2d1719",
      accentColor: "#ff0077",
      backgroundColor: "#ffffff",
      textColor: "#241416",
      buttonStyle: "gradient" as const,
      borderRadius: "pill" as const,
    },
  };

  const parsed = updateRestaurantSchema.parse(superAdminThemePayload);
  assert.deepEqual(parsed.theme, superAdminThemePayload.theme);
});
