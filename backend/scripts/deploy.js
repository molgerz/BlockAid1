const hre = require("hardhat");

async function main() {
    // 1️⃣ Smart Contract holen
    const FundraisingCampaign = await hre.ethers.getContractFactory("CrowdfundingCampaign");

    // 2️⃣ Contract deployen (ggf. mit Parametern)
    const contract = await FundraisingCampaign.deploy(/* Falls dein Contract Konstruktor-Parameter hat, füge sie hier ein */);
    await contract.waitForDeployment();

    console.log("CrowdfundingCampaign deployed to:", await contract.getAddress());
}

// Fehler abfangen
main().catch((error) => {
    console.error(error);
    process.exit(1);
});