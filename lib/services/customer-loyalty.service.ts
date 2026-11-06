import { randomUUID } from "node:crypto";
import { crmRepository } from "@/lib/repositories/crm.repository";
import { restaurantService } from "@/lib/services/restaurant.service";
import { hasRestaurantFeature } from "@/lib/features";
import {
  createPasswordResetToken,
  hashCustomerPassword,
  hashPasswordResetToken,
  verifyCustomerPassword,
} from "@/lib/customer-auth";
import type { CustomerLoyaltyView, CustomerProfile } from "@/types";

export class CustomerLoyaltyServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").trim();
}

function toView(customer: CustomerProfile): CustomerLoyaltyView {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    loyaltyPoints: customer.loyaltyPoints,
    totalOrders: customer.totalOrders,
    segment: customer.segment,
  };
}

export class CustomerLoyaltyService {
  async register(input: {
    restaurantSlug: string;
    name: string;
    phone: string;
    email: string;
    password: string;
  }) {
    const restaurant = await restaurantService.getBySlug(input.restaurantSlug);
    if (!restaurant || restaurant.isActive === false) {
      throw new CustomerLoyaltyServiceError("Restaurant not found.", 404);
    }
    if (!hasRestaurantFeature(restaurant, "CRM_LOYALTY") || restaurant.loyaltySettings?.enabled === false) {
      throw new CustomerLoyaltyServiceError("Loyalty is not enabled for this restaurant.", 403);
    }

    const phone = normalizePhone(input.phone);
    const email = input.email.trim().toLowerCase();
    if (phone.length < 7) throw new CustomerLoyaltyServiceError("Enter a valid phone number.");
    if (input.password.length < 8) {
      throw new CustomerLoyaltyServiceError("Password must be at least 8 characters.");
    }

    const existingPhone = await crmRepository.findByPhone(restaurant.id, phone);
    if (existingPhone?.passwordHash) {
      throw new CustomerLoyaltyServiceError("An account already exists for this phone. Sign in instead.");
    }
    const existingEmail = await crmRepository.findByEmail(restaurant.id, email);
    if (existingEmail && existingEmail.id !== existingPhone?.id) {
      throw new CustomerLoyaltyServiceError("An account already exists for this email.");
    }

    const passwordHash = await hashCustomerPassword(input.password);
    const now = new Date().toISOString();
    const customer = await crmRepository.upsertCustomer({
      id: existingPhone?.id ?? `cust-${randomUUID()}`,
      restaurantId: restaurant.id,
      phone,
      email,
      name: input.name.trim(),
      passwordHash,
      loyaltyPoints: existingPhone?.loyaltyPoints ?? 0,
      totalOrders: existingPhone?.totalOrders ?? 0,
      totalSpend: existingPhone?.totalSpend ?? 0,
      marketingOptIn: false,
      smsOptIn: false,
      emailOptIn: true,
      segment: existingPhone?.segment ?? "NEW",
      createdAt: existingPhone?.createdAt ?? now,
      updatedAt: now,
    });

    await crmRepository.setCustomerCredentials(restaurant.id, customer.id, {
      passwordHash,
      email,
      name: input.name.trim(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });

    const fresh = await crmRepository.getCustomer(restaurant.id, customer.id);
    return {
      restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
      customer: toView(fresh!),
    };
  }

  async login(input: { restaurantSlug: string; phoneOrEmail: string; password: string }) {
    const restaurant = await restaurantService.getBySlug(input.restaurantSlug);
    if (!restaurant || restaurant.isActive === false) {
      throw new CustomerLoyaltyServiceError("Restaurant not found.", 404);
    }
    const identity = input.phoneOrEmail.trim();
    const byEmail = identity.includes("@");
    const customer = byEmail
      ? await crmRepository.findAuthByEmail(restaurant.id, identity)
      : await crmRepository.findAuthByPhone(restaurant.id, normalizePhone(identity));
    if (!customer?.passwordHash) {
      throw new CustomerLoyaltyServiceError("Invalid phone/email or password.", 401);
    }
    const ok = await verifyCustomerPassword(input.password, customer.passwordHash);
    if (!ok) throw new CustomerLoyaltyServiceError("Invalid phone/email or password.", 401);
    return {
      restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
      customer: toView(customer),
    };
  }

  async requestPasswordReset(input: { restaurantSlug: string; email: string }) {
    const restaurant = await restaurantService.getBySlug(input.restaurantSlug);
    if (!restaurant || restaurant.isActive === false) {
      throw new CustomerLoyaltyServiceError("Restaurant not found.", 404);
    }
    const customer = await crmRepository.findAuthByEmail(restaurant.id, input.email);
    // Always return generic success to avoid account enumeration.
    if (!customer?.passwordHash) {
      return { accepted: true as const, resetPath: null as string | null };
    }
    const { token, tokenHash, expiresAt } = createPasswordResetToken();
    await crmRepository.setCustomerCredentials(restaurant.id, customer.id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    });
    const resetPath = `/menu/${restaurant.slug}/loyalty/reset?token=${token}`;
    // No mailer configured yet — return path for client display once; production should email it.
    return { accepted: true as const, resetPath };
  }

  async resetPassword(input: { restaurantSlug: string; token: string; password: string }) {
    const restaurant = await restaurantService.getBySlug(input.restaurantSlug);
    if (!restaurant || restaurant.isActive === false) {
      throw new CustomerLoyaltyServiceError("Restaurant not found.", 404);
    }
    if (input.password.length < 8) {
      throw new CustomerLoyaltyServiceError("Password must be at least 8 characters.");
    }
    const tokenHash = hashPasswordResetToken(input.token);
    const customer = await crmRepository.findByResetTokenHash(restaurant.id, tokenHash);
    if (!customer?.passwordResetExpiresAt || customer.passwordResetExpiresAt < new Date().toISOString()) {
      throw new CustomerLoyaltyServiceError("Reset link is invalid or expired.", 400);
    }
    const passwordHash = await hashCustomerPassword(input.password);
    await crmRepository.setCustomerCredentials(restaurant.id, customer.id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
    return { ok: true as const };
  }

  async getView(restaurantId: string, customerId: string) {
    const customer = await crmRepository.getCustomer(restaurantId, customerId);
    return customer ? toView(customer) : null;
  }
}

export const customerLoyaltyService = new CustomerLoyaltyService();
