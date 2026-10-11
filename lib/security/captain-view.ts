import type { Captain, CaptainView } from "@/types";

export function toCaptainView(captain: Captain): CaptainView {
  const safeCaptain: Partial<Captain> = { ...captain };
  delete safeCaptain.passwordHash;
  const passwordConfigured = Boolean(captain.passwordCiphertext && captain.passwordIv && captain.passwordAuthTag);
  delete safeCaptain.passwordCiphertext;
  delete safeCaptain.passwordIv;
  delete safeCaptain.passwordAuthTag;
  return { ...safeCaptain, passwordConfigured } as CaptainView;
}
