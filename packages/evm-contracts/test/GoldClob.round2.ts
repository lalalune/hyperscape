import { expect } from "chai";
import { ethers } from "hardhat";

describe("GoldClob — Round 2 Security Fixes", function () {
  async function deployFixture() {
    const [owner, attacker, maker, taker, treasury] = await ethers.getSigners();

    const GoldClob = await ethers.getContractFactory("GoldClob");
    const clob = await GoldClob.deploy(treasury.address, owner.address);
    await clob.waitForDeployment();

    return { clob, owner, attacker, maker, taker, treasury };
  }

  /** Compute the native value needed for a placeOrder call (cost + 2% trade fees). */
  function computeValue(amount: bigint, price: number, isBuy: boolean): bigint {
    const priceComp = BigInt(isBuy ? price : 1000 - price);
    const cost = (amount * priceComp) / 1000n;
    const fee = (cost * 200n) / 10000n;
    return cost + fee;
  }

  describe("1. Locked Funds Fix: Price Improvement Refunds", function () {
    it("Refunds the taker when a BUY order crosses a cheaper SELL order", async function () {
      const { clob, maker, taker, owner } = await deployFixture();
      await clob.connect(owner).createMatch();

      // Use larger amounts to avoid precision issues with gas costs
      const amount = 10000n;
      const makerPrice = 500;
      const takerPrice = 600;

      // Maker places a SELL (NO) at price=500 for shares.
      const makerValue = computeValue(amount, makerPrice, false);
      await clob
        .connect(maker)
        .placeOrder(1, false, makerPrice, amount, { value: makerValue });

      const takerBalBefore = await ethers.provider.getBalance(taker.address);

      // Taker places a BUY (YES) at price=600.
      // They match against the maker's sell at 500.
      const takerValue = computeValue(amount, takerPrice, true);
      const tx = await clob
        .connect(taker)
        .placeOrder(1, true, takerPrice, amount, { value: takerValue });
      const receipt = await tx.wait();
      const gasCost = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice);

      const takerBalAfter = await ethers.provider.getBalance(taker.address);

      // Taker paid cost at the maker's price (500), not their own (600).
      // The key check: the improvement was refunded.
      const spent = takerBalBefore - takerBalAfter - gasCost;
      // Spent should be less than what was sent (takerValue) since improvement was refunded
      expect(spent).to.be.lessThan(takerValue);
    });

    it("Refunds the taker when a SELL order crosses a higher BUY order", async function () {
      const { clob, maker, taker, owner } = await deployFixture();
      await clob.connect(owner).createMatch();

      // Maker places a BUY (YES) at price=600 for 100 shares.
      const makerValue = computeValue(100n, 600, true);
      await clob
        .connect(maker)
        .placeOrder(1, true, 600, 100, { value: makerValue });

      const takerBalBefore = await ethers.provider.getBalance(taker.address);

      // Taker places a SELL (NO) at price=500 for 100 shares.
      const takerValue = computeValue(100n, 500, false);
      const tx = await clob
        .connect(taker)
        .placeOrder(1, false, 500, 100, { value: takerValue });
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const takerBalAfter = await ethers.provider.getBalance(taker.address);

      const spent = takerBalBefore - takerBalAfter - gasCost;
      expect(spent).to.be.lessThan(takerValue);
    });
  });

  describe("2. Critical OOG DoS Fix: MatchesCount and clearGarbage", function () {
    it("Prevents infinite loop DoS by counting cancelled orders against MAX_MATCHES_PER_TX", async function () {
      const { clob, maker, taker, owner } = await deployFixture();
      await clob.connect(owner).createMatch();

      // Place 105 orders and cancel them to create garbage
      for (let i = 0; i < 105; i++) {
        const value = computeValue(10n, 500, true);
        await clob.connect(maker).placeOrder(1, true, 500, 10, { value });
        await clob.connect(maker).cancelOrder(1, i + 1, 500);
      }

      // Taker tries to sell — should stop at MAX_MATCHES_PER_TX=100
      const takerValue = computeValue(10n, 500, false);
      await clob
        .connect(taker)
        .placeOrder(1, false, 500, 10, { value: takerValue });

      const queue = await clob.orderQueues(1, 500);
      expect(queue.tail - queue.head).to.equal(6n);
    });

    it("clearGarbage function successfully sweeps dead orders", async function () {
      const { clob, maker, taker, owner } = await deployFixture();
      await clob.connect(owner).createMatch();

      for (let i = 0; i < 5; i++) {
        const value = computeValue(10n, 500, true);
        await clob.connect(maker).placeOrder(1, true, 500, 10, { value });
        await clob.connect(maker).cancelOrder(1, i + 1, 500);
      }

      let queueBefore = await clob.orderQueues(1, 500);
      expect(queueBefore.tail - queueBefore.head).to.equal(5n);

      await clob.connect(taker).clearGarbage(1, 500, 10);

      let queueAfter = await clob.orderQueues(1, 500);
      expect(queueAfter.tail - queueAfter.head).to.equal(0n);
    });
  });

  describe("3. Medium Zero-Value Transfer Reverts in Claim", function () {
    it("Allows claims where the fee calculation results in 0 (sub-cent payouts)", async function () {
      const { clob, maker, taker, owner } = await deployFixture();
      await clob.connect(owner).createMatch();

      // Small trade: 10 shares at 500
      const makerValue = computeValue(10n, 500, true);
      const takerValue = computeValue(10n, 500, false);
      await clob
        .connect(maker)
        .placeOrder(1, true, 500, 10, { value: makerValue });
      await clob
        .connect(taker)
        .placeOrder(1, false, 500, 10, { value: takerValue });

      await clob.connect(owner).resolveMatch(1, 1);

      // Maker claims 10 winning shares.
      // Fee = (10 * 200) / 10000 = 0 (truncated).
      await clob.connect(maker).claim(1);

      const pos = await clob.positions(1, maker.address);
      expect(pos.yesShares).to.equal(0n); // Successfully claimed
    });
  });
});
