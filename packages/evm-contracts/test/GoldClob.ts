import { expect } from "chai";
import { ethers } from "hardhat";

describe("GoldClob", function () {
  async function deployFixture() {
    const [owner, maker, taker, treasury] = await ethers.getSigners();

    const GoldClob = await ethers.getContractFactory("GoldClob");
    const clob = await GoldClob.deploy(treasury.address, owner.address);
    await clob.waitForDeployment();

    return { clob, owner, maker, taker, treasury };
  }

  it("Should create a match", async function () {
    const { clob } = await deployFixture();
    await clob.createMatch();
    const meta = await clob.matches(1);
    expect(meta.status).to.equal(1n); // OPEN
  });

  it("Should match orders", async function () {
    const { clob, maker, taker } = await deployFixture();
    await clob.createMatch();

    // Maker: Buy YES 10 shares @ 600 ($0.60)
    // cost = (10 * 600) / 1000 = 6 wei, plus fees
    const makerCost = (10n * 600n) / 1000n;
    const makerFee = (makerCost * 200n) / 10000n; // 2% total trade fees
    await clob
      .connect(maker)
      .placeOrder(1, true, 600, 10, { value: makerCost + makerFee });

    // Taker: Sell YES 10 shares @ 600 (NO side cost = (10 * 400) / 1000 = 4)
    const takerCost = (10n * 400n) / 1000n;
    const takerFee = (takerCost * 200n) / 10000n;
    await clob
      .connect(taker)
      .placeOrder(1, false, 600, 10, { value: takerCost + takerFee });

    const posMaker = await clob.positions(1, maker.address);
    const posTaker = await clob.positions(1, taker.address);

    expect(posMaker.yesShares).to.equal(10n);
    expect(posTaker.noShares).to.equal(10n);
  });
});
