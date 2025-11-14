/**
 * X402 Payment Middleware for Hyperscape
 */

import { ethers } from "ethers";

const SERVICES = {
  "gold-claim": "1 elizaOS",
  "item-mint": "5 elizaOS",
  "marketplace-list": "0.1 elizaOS",
  "trade-escrow": "0.5 elizaOS",
};

export class X402PaymentHandler {
  async verifyPayment(
    txHash: string,
    _service: string,
    _user: string,
  ): Promise<boolean> {
    // Verify transaction on Jeju chain
    const provider = new ethers.JsonRpcProvider(
      process.env.JEJU_RPC_URL || "http://localhost:8545",
    );
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt?.status === 1;
  }

  async requirePayment(service: keyof typeof SERVICES) {
    return (
      req: Record<string, unknown>,
      res: Record<string, unknown> & {
        status: (code: number) => {
          json: (data: Record<string, unknown>) => void;
        };
      },
      next: () => void,
    ) => {
      const payment = req.headers["payment"];
      if (!payment) {
        res.status(402).json({
          error: "Payment Required",
          service,
          amount: SERVICES[service],
          currency: "elizaOS",
        });
        return;
      }
      next();
    };
  }
}

export const x402 = new X402PaymentHandler();
