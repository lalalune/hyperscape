import { expect } from "chai";
import { ethers } from "hardhat";

type Rng = () => number;

function createRng(seed: bigint): Rng {
  let state = seed;
  return () => {
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    const value = Number(state & 0xffff_ffffn);
    return Math.abs(value) / 0xffff_ffff;
  };
}

function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function expectKnownRevert(error: unknown, reasons: string[]) {
  const message = error instanceof Error ? error.message : String(error);
  if (reasons.some((reason) => message.includes(reason))) {
    return;
  }
  throw error;
}

async function expectRevert(
  action: Promise<unknown>,
  reason: string,
): Promise<void> {
  try {
    await action;
    expect.fail(`Expected revert containing "${reason}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).to.include(reason);
  }
}

describe("GoldClob — Randomized Invariants", function () {
  async function deployFixture() {
    const [admin, treasury, marketMaker, ...traders] =
      await ethers.getSigners();
    const activeTraders = traders.slice(0, 12);

    const GoldClob = await ethers.getContractFactory("GoldClob");
    const clob = await GoldClob.deploy(treasury.address, marketMaker.address);
    await clob.waitForDeployment();

    return {
      clob,
      admin,
      treasury,
      marketMaker,
      traders: activeTraders,
    };
  }

  /** Compute native value needed for placeOrder (cost + 2% trade fee). */
  function computeValue(amount: bigint, price: number, isBuy: boolean): bigint {
    const priceComp = BigInt(isBuy ? price : 1000 - price);
    const cost = (amount * priceComp) / 1000n;
    const fee = (cost * 200n) / 10000n;
    return cost + fee;
  }

  it("holds claim/fee invariants under randomized order flow", async function () {
    const seeds = [0x1001n, 0x2002n, 0x3003n, 0x4004n];

    for (const seed of seeds) {
      const { clob, admin, treasury, marketMaker, traders } =
        await deployFixture();

      await clob.connect(admin).createMatch();
      const matchId = 1n;
      const rng = createRng(seed);
      const openOrderIds = new Map<string, bigint[]>();
      for (const trader of traders) {
        openOrderIds.set(trader.address.toLowerCase(), []);
      }

      const operations = 140;
      for (let i = 0; i < operations; i += 1) {
        const trader = traders[randomInt(rng, 0, traders.length - 1)];
        const key = trader.address.toLowerCase();
        const ordersForTrader = openOrderIds.get(key)!;

        if (rng() < 0.75 || ordersForTrader.length === 0) {
          const isBuy = rng() > 0.5;
          const price = randomInt(rng, 1, 999);
          const amount = BigInt(randomInt(rng, 1, 2400));
          const beforeOrderId = await clob.nextOrderId();

          try {
            const value = computeValue(amount, price, isBuy);
            await clob
              .connect(trader)
              .placeOrder(matchId, isBuy, price, amount, { value });
            const afterOrderId = await clob.nextOrderId();
            if (afterOrderId === beforeOrderId + 1n) {
              ordersForTrader.push(beforeOrderId);
            }
          } catch (error) {
            expectKnownRevert(error, [
              "Cost too low",
              "Native transfer failed",
              "Amount/Price precision error",
              "Insufficient native currency sent",
            ]);
          }
          continue;
        }

        const orderIndex = randomInt(rng, 0, ordersForTrader.length - 1);
        const orderId = ordersForTrader[orderIndex];
        const order = await clob.orders(orderId);
        const stillOpen =
          order.filled < order.amount && order.matchId === matchId;
        if (!stillOpen) {
          ordersForTrader.splice(orderIndex, 1);
          continue;
        }

        try {
          await clob
            .connect(trader)
            .cancelOrder(matchId, orderId, Number(order.price));
          ordersForTrader.splice(orderIndex, 1);
        } catch (error) {
          expectKnownRevert(error, [
            "Already filled",
            "Wrong match",
            "Not maker",
          ]);
          ordersForTrader.splice(orderIndex, 1);
        }
      }

      const winner = rng() > 0.5 ? 1 : 2;
      await clob.connect(admin).resolveMatch(matchId, winner);

      for (const trader of traders) {
        const position = await clob.positions(matchId, trader.address);
        const winningShares =
          winner === 1 ? position.yesShares : position.noShares;
        if (winningShares === 0n) {
          await expectRevert(
            clob.connect(trader).claim(matchId),
            "Nothing to claim",
          );
          continue;
        }

        const traderBefore = await ethers.provider.getBalance(trader.address);
        const marketMakerBefore = await ethers.provider.getBalance(
          marketMaker.address,
        );

        const tx = await clob.connect(trader).claim(matchId);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const fee = (winningShares * 200n) / 10000n;
        const payout = winningShares - fee;

        const traderAfter = await ethers.provider.getBalance(trader.address);
        const marketMakerAfter = await ethers.provider.getBalance(
          marketMaker.address,
        );

        expect(traderAfter - traderBefore + gasCost).to.equal(payout);
        expect(marketMakerAfter - marketMakerBefore).to.equal(fee);

        await expectRevert(
          clob.connect(trader).claim(matchId),
          "Nothing to claim",
        );
      }
    }
  });
});
