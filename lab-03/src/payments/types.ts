export type PaymentStatus = "paid" | "processing" | "failed";

export type PaymentRequest = {
  orderId: string;
  paymentToken: string;
  amount: number;
  currency: string;
};

export type PaymentResult = {
  status: PaymentStatus;
  reference: string;
};