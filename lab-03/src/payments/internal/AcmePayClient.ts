export type AcmePayRequest = {
  merchant_ref: string;
  payment_source: string;
  total: string;
  cur: string;
};

export type AcmePayResponse = {
  txn: string;
  outcome: "APPROVED" | "IN_REVIEW" | "REJECTED";
};

// Local deterministic stand-in for a second provider, driven by the payment source prefix.
export class AcmePayClient {
  async submit(request: AcmePayRequest): Promise<AcmePayResponse> {
    const source = request.payment_source;
    const outcome = source.startsWith("fail_")
      ? "REJECTED"
      : source.startsWith("proc_")
        ? "IN_REVIEW"
        : "APPROVED";
    return { txn: `acme_${request.merchant_ref}`, outcome };
  }
}