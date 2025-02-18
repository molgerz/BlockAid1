import { useState, useEffect } from "react";
import { ethers } from "ethers";
import HeaderBar from "./components/HeaderBar"
import CreateCampaignModal from "./components/CreateCampaignModal"
import CampaignCard from "./components/CampaignCard";

// Adresse des deployed Contracts
const CONTRACT_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

// Contract-ABI: Definiert die Funktionen, die vom Contract bereitgestellt werden
const ABI = [
    "event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 donationAmount, uint256 currentAmount)",
    "function createCampaign(address _owner, string memory _title, string memory _description, string memory _image, uint256 _goal, uint256 _deadline) external returns (uint)",
    "function donate(uint256 _id) external payable",
    "function deleteCampaign(uint256 _id) external",
    "function getCampaigns() external view returns (tuple(address owner, string title, string description, string image, uint256 goal, uint256 deadline, uint256 currentAmount, uint256 status, address[] donators, uint256[] donations)[] memory)",
    "function withdrawFunds(uint256 _id) external",
    "function claimRefund(uint256 _id) external"
];

function App() {
    // React States für Wallet-Adresse, Contract-Instanz und Kampagnendaten
    const [account, setAccount] = useState(null);
    const [contract, setContract] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Lädt die Kampagnen, sobald der Contract geladen wurde
    useEffect(() => {
        if (contract) {
            loadCampaigns();
        }
    }, [contract]);

    // Verbindet die Wallet des Nutzers über Metamask und initialisiert den Contract
    async function connectWallet() {
        if (!window.ethereum) {
            alert("Metamask nicht installiert!");
            return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);

        await provider.send("eth_requestAccounts", []);

        const signer = await provider.getSigner();
        signer.resolveName = async () => null; // ENS-Fix

        const userAddress = await signer.getAddress();
        setAccount(userAddress);

        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        setContract(contractInstance);

        console.log("🚀 Verwendete Contract-Adresse:", CONTRACT_ADDRESS);
    }

    // Erstellt eine neue Kampagne
    async function createCampaign(data) {
        if (!contract) return;
        const { title, description, image, goal, deadline } = data;
        const goalInWei = ethers.parseEther(goal); // ETH in Wei umwandeln
        const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000); // Unix Timestamp

        try {
            const tx = await contract.createCampaign(
                account,
                title,
                description,
                image,
                goalInWei,
                deadlineTimestamp,
            );

            await tx.wait();
            loadCampaigns();

        } catch (error) {
            console.error("Fehler beim Erstellen der Kampagne:", error);
        }
    }

    // Spende an eine Kampagne
    async function donateToCampaign(campaignId) {
        if (!contract) return;

        const amount = document.getElementById(`donation-${campaignId}`).value || "0";

        if (amount <= 0) {
            alert("Bitte einen gültigen Betrag eingeben!");
            return;
        }

        try {
            const tx = await contract.donate(campaignId, { value: ethers.parseEther(amount) });
            await tx.wait();
            loadCampaigns();

            document.getElementById(`donation-${campaignId}`).value = "";
        } catch (error) {
            console.error("Fehler beim Spenden:", error);
        }
    }

    // Löst die Auszahlung der Gelder für den Kampagnenersteller aus
    async function withdrawFunds(campaignId) {
        if (!contract) return;
        try {
            const tx = await contract.withdrawFunds(campaignId);
            await tx.wait();
            loadCampaigns();
        } catch (error) {
            console.error("Fehler bei Auszahlung:", error);
            alert("Fehler bei Auszahlung, siehe Konsole.");
        }
    }

    // Ermöglicht einem Spender, seinen Anteil zurückzufordern
    async function claimRefund(campaignId) {
        if (!contract) return;
        try {
            const tx = await contract.claimRefund(campaignId);
            await tx.wait();
            loadCampaigns();
        } catch (error) {
            console.error("Fehler bei Refund:", error);
            alert("Fehler beim Refund, siehe Konsole.");
        }
    }

    // Löscht eine Kampagne (nur der Ersteller kann dies ausführen)
    async function deleteCampaign(campaignId) {
        if (!contract) {
            console.error("Kein Contract-Objekt vorhanden!");
            return;
        }

        try {
            const campaign = campaigns[campaignId];

            if (account.toLowerCase() !== campaign.owner.toLowerCase()) {
                console.error("Du bist nicht der Owner dieser Kampagne!");
                alert("Du bist nicht der Ersteller dieser Kampagne!");
                return;
            }

            const tx = await contract.deleteCampaign(campaignId);
            await tx.wait();
            loadCampaigns();
        } catch (error) {
            console.error("Fehler beim Löschen der Kampagne:", error);
            alert("Fehler beim Löschen der Kampagne! Details in der Konsole.");
        }
    }

    // Lädt alle Kampagnendaten vom Contract und speichert sie im State
    async function loadCampaigns() {
        if (!contract) return;

        try {
            const campaignsArray = await contract.getCampaigns();
            const campaignsWithIds = campaignsArray.map(([owner, title, description, image, goal, deadline, currentAmount, status], id) => ({
                id, owner, title, description, image, goal, deadline, currentAmount, status
            }));

            setCampaigns(campaignsWithIds);
        } catch (error) {
            console.error("Fehler beim Abrufen der Kampagnen:", error);
        }
    }

    return (
        <div style={{ marginTop: "60px" }}>
            <HeaderBar
                walletAddress={account}
                onCreateCampaign={() => setIsModalOpen(true)}
                onConnectWallet={connectWallet}
            />
            <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
                {account && (
                    <>
                        <h1>Alle Projekte</h1>
                        {campaigns.length === 0 ? (
                            <p>Keine Kampagnen vorhanden.</p>
                        ) : (
                            campaigns
                                .filter(c => Number(c.status) < 2)
                                .map((c) => (
                                    <CampaignCard
                                        key={c.id}
                                        campaign={c}
                                        account={account}
                                        donateToCampaign={donateToCampaign}
                                        deleteCampaign={deleteCampaign}
                                        withdrawFunds={withdrawFunds}
                                        claimRefund={claimRefund}
                                        contract={contract}
                                    />
                                ))
                        )}
                    </>
                )}
            </div>
            <CreateCampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreateCampaign={createCampaign}
            />
        </div>
    );
}

export default App;