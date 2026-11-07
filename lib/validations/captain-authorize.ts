import { z } from "zod";

export const captainAuthorizeSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT", "CORRECTION"]),
    reason: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().uuid(),
    sendToKitchen: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.decision === "REJECT" || value.decision === "CORRECTION") && !value.reason?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason is required for rejection or correction.",
      });
    }
  });
