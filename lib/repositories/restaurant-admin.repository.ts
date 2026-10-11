import { randomUUID } from "node:crypto";
import type { RestaurantAdminAccount } from "@/types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { RestaurantAdminAccountModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

const toAccount = (value: unknown) => toDomain<RestaurantAdminAccount>(value);
const privateCredentialFields = "+passwordHash +passwordCiphertext +passwordIv +passwordAuthTag";
const encryptedCredentialFields = "+passwordCiphertext +passwordIv +passwordAuthTag";
const credentialStatusFields = "+passwordHash +passwordCiphertext +passwordIv +passwordAuthTag";

export class RestaurantAdminRepository {
  async findByRestaurantId(restaurantId: string) {
    await connectToDatabase();
    const account = await RestaurantAdminAccountModel.findOne({ restaurantId }).lean();
    return account ? toAccount(account) : null;
  }

  async findCredentialByRestaurantId(restaurantId: string) {
    await connectToDatabase();
    const account = await RestaurantAdminAccountModel.findOne({ restaurantId })
      .select(encryptedCredentialFields)
      .lean();
    return account ? toAccount(account) : null;
  }

  async findCredentialStatusByRestaurantId(restaurantId: string) {
    await connectToDatabase();
    const account = await RestaurantAdminAccountModel.findOne({ restaurantId })
      .select(credentialStatusFields)
      .lean();
    return account ? toAccount(account) : null;
  }

  async findByRestaurantAndEmail(restaurantId: string, email: string) {
    await connectToDatabase();
    const account = await RestaurantAdminAccountModel.findOne({ restaurantId, email })
      .select("+passwordHash")
      .lean();
    return account ? toAccount(account) : null;
  }

  async findByEmail(email: string) {
    await connectToDatabase();
    const accounts = await RestaurantAdminAccountModel.find({ email })
      .select("+passwordHash")
      .lean();
    return accounts.map(toAccount);
  }

  async findCredentialStatuses(restaurantIds: string[]) {
    await connectToDatabase();
    const accounts = await RestaurantAdminAccountModel.find({ restaurantId: { $in: restaurantIds } })
      .select(credentialStatusFields)
      .lean();
    return accounts.map(toAccount);
  }

  async createIfAbsent(input: Omit<RestaurantAdminAccount, "id" | "createdAt" | "updatedAt">) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const account = await RestaurantAdminAccountModel.findOneAndUpdate(
      { restaurantId: input.restaurantId },
      {
        $setOnInsert: {
          ...input,
          id: `restaurant-admin-${randomUUID()}`,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).select(privateCredentialFields).lean();
    return account ? toAccount(account) : null;
  }

  async setCredentials(restaurantId: string, input: Pick<RestaurantAdminAccount, "email" | "passwordHash" | "passwordCiphertext" | "passwordIv" | "passwordAuthTag">) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const account = await RestaurantAdminAccountModel.findOneAndUpdate(
      { restaurantId },
      {
        $set: { ...input, updatedAt: now },
        $setOnInsert: {
          id: `restaurant-admin-${randomUUID()}`,
          restaurantId,
          isActive: true,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).select(privateCredentialFields).lean();
    return account ? toAccount(account) : null;
  }

  async setActive(restaurantId: string, isActive: boolean) {
    await connectToDatabase();
    const account = await RestaurantAdminAccountModel.findOneAndUpdate(
      { restaurantId },
      { $set: { isActive, updatedAt: new Date().toISOString() } },
      { returnDocument: "after", runValidators: true },
    ).select(credentialStatusFields).lean();
    return account ? toAccount(account) : null;
  }
}

export const restaurantAdminRepository = new RestaurantAdminRepository();
