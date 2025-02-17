const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrowdfundingCampaign", function () {
  let CrowdfundingCampaign, crowdfunding, owner, donor1, donor2, other;
  const ONE_ETHER = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, donor1, donor2, other] = await ethers.getSigners();
    const CrowdfundingCampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
    crowdfunding = await CrowdfundingCampaignFactory.deploy();
    await crowdfunding.waitForDeployment();
  });

  describe("createCampaign", function () {
    it("should create a campaign with valid deadline", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const deadline = now + 3600; // 1 Stunde in der Zukunft

      const tx = await crowdfunding.createCampaign(
        owner.address,
        "Test Campaign",
        "Description",
        "Image URL",
        ONE_ETHER,
        deadline
      );
      await tx.wait();

      // Die Kampagne hat die ID 0, da numberOfCampaigns inkrementiert wurde
      expect(await crowdfunding.numberOfCampaigns()).to.equal(1);

      // Hole die Kampagne via getter
      const campaignArray = await crowdfunding.getCampaigns();
      expect(campaignArray[0].owner).to.equal(owner.address);
      expect(campaignArray[0].title).to.equal("Test Campaign");
      expect(campaignArray[0].currentAmount).to.equal(0);
    });

    it("should revert if deadline is in the past", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await expect(
        crowdfunding.createCampaign(
          owner.address,
          "Past Campaign",
          "Desc",
          "Image",
          ONE_ETHER,
          now - 10
        )
      ).to.be.reverted;
    });
  });

  describe("donate", function () {
    let campaignId, deadline;
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      deadline = now + 3600;
      const tx = await crowdfunding.createCampaign(
        owner.address,
        "Donation Campaign",
        "Desc",
        "Image",
        ethers.parseEther("2"), // Ziel: 2 ETH
        deadline
      );
      await tx.wait();
      campaignId = 0;
    });

    it("should accept donations and emit event", async function () {
      const donateTx = await crowdfunding.connect(donor1).donate(campaignId, { value: ONE_ETHER });
      await expect(donateTx)
        .to.emit(crowdfunding, "DonationReceived")
        .withArgs(campaignId, donor1.address, ONE_ETHER, ONE_ETHER);

      // Prüfe, ob currentAmount erhöht wurde
      const campaigns = await crowdfunding.getCampaigns();
      expect(campaigns[0].currentAmount).to.equal(ONE_ETHER);
    });

    it("should revert donation if campaign is inactive (e.g. deadline passed)", async function () {
      // Erhöhe die Zeit, sodass die Deadline überschritten wird
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        crowdfunding.connect(donor1).donate(campaignId, { value: ONE_ETHER })
      ).to.be.reverted;
    });
  });

  describe("withdrawFunds", function () {
    let campaignId, deadline;
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      deadline = now + 3600;
      // Ziel: 1 ETH
      const tx = await crowdfunding.createCampaign(
        owner.address,
        "Withdraw Campaign",
        "Desc",
        "Image",
        ONE_ETHER,
        deadline
      );
      await tx.wait();
      campaignId = 0;
      // Spende 1 ETH, sodass Ziel erreicht wird
      await crowdfunding.connect(donor1).donate(campaignId, { value: ONE_ETHER });
    });

    it("should allow owner to withdraw funds if goal is reached", async function () {
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await crowdfunding.withdrawFunds(campaignId);
      await tx.wait();
      // Prüfe, dass currentAmount nun 0 ist
      const campaigns = await crowdfunding.getCampaigns();
      expect(campaigns[0].currentAmount).to.equal(0);
      // Status soll auf 1 gesetzt sein
      expect(campaigns[0].status).to.equal(1);
      // Überprüfe, dass Owner Geld erhalten hat (Beachte: Gas-Kosten werden abgezogen)
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });

    it("should revert withdraw if caller is not owner", async function () {
      await expect(
        crowdfunding.connect(donor1).withdrawFunds(campaignId)
      ).to.be.reverted;
    });

    it("should revert withdraw if goal is not reached", async function () {
      // Erstelle einen neuen Campaign, bei dem das Ziel noch nicht erreicht ist
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const newDeadline = now + 3600;
      const tx = await crowdfunding.createCampaign(
        owner.address,
        "New Campaign",
        "Desc",
        "Image",
        ethers.parseEther("3"), // Ziel: 3 ETH
        newDeadline
      );
      await tx.wait();
      const newCampaignId = 1;
      await crowdfunding.connect(donor1).donate(newCampaignId, { value: ONE_ETHER });
      await expect(
        crowdfunding.withdrawFunds(newCampaignId)
      ).to.be.reverted;
    });
  });

  describe("claimRefund", function () {
    let campaignId, deadline;
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      deadline = now + 100; // kurze Deadline
      const tx = await crowdfunding.createCampaign(
        owner.address,
        "Refund Campaign",
        "Desc",
        "Image",
        ethers.parseEther("5"), // Ziel: 5 ETH, wird nicht erreicht
        deadline
      );
      await tx.wait();
      campaignId = 0;
      // Zwei Spender spenden jeweils 1 ETH
      await crowdfunding.connect(donor1).donate(campaignId, { value: ONE_ETHER });
      await crowdfunding.connect(donor2).donate(campaignId, { value: ONE_ETHER });
    });

    it("should allow donor to claim refund after deadline if goal not reached", async function () {
      // Erhöhe die Zeit, sodass die Deadline überschritten wird
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      const donor1BalanceBefore = await ethers.provider.getBalance(donor1.address);
      const tx = await crowdfunding.connect(donor1).claimRefund(campaignId);
      await tx.wait();
      // Nach Refund sollte campaign.currentAmount reduziert worden sein
      const campaigns = await crowdfunding.getCampaigns();
      // Da donor1 hat 1 ETH zurückbekommen, sollte currentAmount um 1 ETH gesunken sein
      expect(campaigns[0].currentAmount).to.equal(ONE_ETHER);
      // Zusätzlich revidieren wir, dass bei erneutem ClaimRefund revertet (keine weiteren Gelder)
      await expect(
        crowdfunding.connect(donor1).claimRefund(campaignId)
      ).to.be.reverted;
    });

    it("should revert refund if no donation from caller", async function () {
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        crowdfunding.connect(other).claimRefund(campaignId)
      ).to.be.reverted;
    });
  });

  describe("deleteCampaign and _refundAll", function () {
    let campaignId, deadline;
    beforeEach(async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      deadline = now + 3600;
      // Ziel: 5 ETH, wird nicht erreicht
      const tx = await crowdfunding.createCampaign(
        owner.address,
        "Delete Campaign",
        "Desc",
        "Image",
        ethers.parseEther("5"),
        deadline
      );
      await tx.wait();
      campaignId = 0;
      // Zwei Spender spenden jeweils 1 ETH
      await crowdfunding.connect(donor1).donate(campaignId, { value: ONE_ETHER });
      await crowdfunding.connect(donor2).donate(campaignId, { value: ONE_ETHER });
    });

    it("should delete campaign and refund all if funds exist", async function () {
      const donor1BalanceBefore = await ethers.provider.getBalance(donor1.address);
      const donor2BalanceBefore = await ethers.provider.getBalance(donor2.address);

      // Lösche die Kampagne, was push refund auslöst
      const tx = await crowdfunding.deleteCampaign(campaignId);
      await tx.wait();

      const campaigns = await crowdfunding.getCampaigns();
      // Status soll 3 (gelöscht) sein
      expect(campaigns[0].status).to.equal(3);
      // currentAmount soll 0 sein
      expect(campaigns[0].currentAmount).to.equal(0);

      // Refund wurde durchgeführt. Es ist schwierig, den exakten Saldo zu prüfen wegen Gas,
      // aber wir können zumindest prüfen, dass die donation arrays auf 0 gesetzt wurden.
      const [donators, donations] = await crowdfunding.getDonators(campaignId);
      expect(donations[0]).to.equal(0);
      expect(donations[1]).to.equal(0);
    });

    it("should revert deleteCampaign if caller is not owner", async function () {
      await expect(
        crowdfunding.connect(donor1).deleteCampaign(campaignId)
      ).to.be.reverted;
    });
  });
});