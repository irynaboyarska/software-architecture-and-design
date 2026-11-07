import type { PaymentProvider } from "./provider.ts";
import { createStripeProvider } from "./stripeAdapter.ts";
import { createAcmePayProvider } from "./acmePayAdapter.ts";

export const DEFAULT_PROVIDER = "stripe";

const providers: Record<string, PaymentProvider> = {
  stripe: createStripeProvider(),
  acmepay: createAcmePayProvider(),
};

export function resolveProvider(name: string | undefined): PaymentProvider {
  const key = (name ?? "").trim().toLowerCase() || DEFAULT_PROVIDER;
  const provider = Object.hasOwn(providers, key) ? providers[key] : undefined;
  if (!provider) {
    throw new Error(`Unknown payment provider: ${key}`);
  }
  return provider;
}