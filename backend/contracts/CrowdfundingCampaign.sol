// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Custom Errors
error NotOwner(address sender);
error DeadlineNotReached(uint256 deadline, uint256 currentTime);
error CampaignNotOpen(uint256 status);
error GoalReached();
error DeadlinePassed(uint256 deadline, uint256 currentTime);
error NoFunds();
error GoalNotReached();
error TransferFailed();

/// @title CrowdfundingCampaign
/// @notice Dieser Contract verwaltet Crowdfunding-Kampagnen.
contract CrowdfundingCampaign is ReentrancyGuard {
    struct Campaign {
        address owner;
        string title;
        string description;
        string image;
        uint256 goal;
        uint256 deadline;
        uint256 currentAmount;
        uint256 status; // 0 = Offen (oder Erfolgreich/Fehlgeschlagen, aber noch nicht ausgezahlt), 1 = Auszahlung durchgeführt, 2 = Refund durchgeführt, 3 = Kampagne gelöscht
        address[] donators;
        uint256[] donations;
    }

    // Speichert alle Kampagnen, indexiert durch ihre eindeutige ID.
    mapping(uint256 => Campaign) public campaigns;
    // Zähler für die insgesamt erstellten Kampagnen.
    uint256 public numberOfCampaigns = 0;

    // Events
    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 donationAmount,
        uint256 currentAmount
    );

    // Modifiers
    modifier onlyOwner(uint256 _id) {
        if (msg.sender != campaigns[_id].owner) revert NotOwner(msg.sender);
        _;
    }

    modifier afterDeadline(uint256 _id) {
        if (block.timestamp <= campaigns[_id].deadline)
            revert DeadlineNotReached(campaigns[_id].deadline, block.timestamp);
        _;
    }

    modifier refundable(uint256 _id) {
        if (campaigns[_id].currentAmount >= campaigns[_id].goal)
            revert GoalReached();
        _;
    }

    modifier hasFunds(uint256 _id) {
        if (campaigns[_id].currentAmount == 0) revert NoFunds();
        _;
    }

    modifier onlyActiveCampaign(uint256 _id) {
        Campaign storage campaign = campaigns[_id];
        if (campaign.status != 0) revert CampaignNotOpen(campaign.status);
        if (campaign.currentAmount >= campaign.goal) revert GoalReached();
        if (block.timestamp >= campaign.deadline)
            revert DeadlinePassed(campaign.deadline, block.timestamp);
        _;
    }

    /*
     * Funktion: createCampaign
     * Zweck: Erstellt eine neue Kampagne mit den angegebenen Parametern.
     * Rückgabe: Die ID der erstellten Kampagne.
     */
    function createCampaign(
        address _owner,
        string memory _title,
        string memory _description,
        string memory _image,
        uint256 _goal,
        uint256 _deadline
    ) external returns (uint) {
        Campaign storage campaign = campaigns[numberOfCampaigns];
        if (_deadline <= block.timestamp)
            revert DeadlineNotReached(_deadline, block.timestamp);

        campaign.owner = _owner;
        campaign.title = _title;
        campaign.description = _description;
        campaign.image = _image;
        campaign.goal = _goal;
        campaign.deadline = _deadline;
        campaign.currentAmount = 0;
        campaign.status = 0; // Status: Offen

        numberOfCampaigns++;
        return numberOfCampaigns - 1;
    }

    /*
     * Funktion: donate
     * Zweck: Akzeptiert Spenden für eine Kampagne und erhöht den aktuellen Betrag.
     * Einschränkung: Nur für aktive Kampagnen (über den Modifier onlyActiveCampaign).
     */
    function donate(uint256 _id) external payable onlyActiveCampaign(_id) {
        uint256 amount = msg.value;
        Campaign storage campaign = campaigns[_id];
        campaign.donators.push(msg.sender);
        campaign.donations.push(amount);
        campaign.currentAmount += amount;
        emit DonationReceived(_id, msg.sender, amount, campaign.currentAmount);
    }

    /*
     * Funktion: _sendFunds
     * Zweck: Interne Funktion, die einen Transfer ausführt und sicherstellt, dass er erfolgreich war.
     * Rückgabe: true, wenn der Transfer erfolgreich war.
     */
    function _sendFunds(
        address payable recipient,
        uint256 amount
    ) private returns (bool) {
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();
        return sent;
    }

    /*
     * Funktion: withdrawFunds
     * Zweck: Erlaubt dem Kampagnenersteller, die gesammelten Gelder abzuheben, sofern das Ziel erreicht wurde.
     * Einschränkung: Nur vom Owner, mit Sicherheitsprüfungen durch die Modifier.
     */
    function withdrawFunds(
        uint256 _id
    ) external nonReentrant onlyOwner(_id) hasFunds(_id) {
        Campaign storage campaign = campaigns[_id];
        if (campaign.currentAmount < campaign.goal) revert GoalNotReached();
        uint256 amount = campaign.currentAmount;
        campaign.currentAmount = 0;
        _sendFunds(payable(campaign.owner), amount);
        campaign.status = 1; // Status: Auszahlung durchgeführt
    }

    /*
     * Funktion: claimRefund
     * Zweck: Ermöglicht Spendern mittels Pull-Refund, eine Rückerstattung ihrer Spende zu beantragen, falls das Ziel nicht erreicht wurde.
     * Einschränkung: Kann nur nach Ablauf der Deadline und wenn das Ziel nicht erreicht wurde aufgerufen werden.
     */
    function claimRefund(
        uint256 _id
    ) external nonReentrant afterDeadline(_id) refundable(_id) {
        Campaign storage campaign = campaigns[_id];
        uint256 refundAmount = 0;
        for (uint256 i = 0; i < campaign.donators.length; i++) {
            if (campaign.donators[i] == msg.sender) {
                refundAmount += campaign.donations[i];
                campaign.donations[i] = 0;
            }
        }
        if (refundAmount == 0) revert NoFunds();
        _sendFunds(payable(msg.sender), refundAmount);
        campaign.currentAmount -= refundAmount;
        if (campaign.currentAmount == 0) {
            campaign.status = 2; // Status: Refund durchgeführt
        }
    }

    /*
     * Funktion: _refundAll
     * Zweck: Führt einen Push-Refund durch, indem alle Spender refundiert werden.
     * Einschränkung: Interne Funktion, die nur über deleteCampaign aufgerufen wird.
     */
    function _refundAll(uint256 _id) private refundable(_id) hasFunds(_id) {
        Campaign storage campaign = campaigns[_id];
        for (uint256 i = 0; i < campaign.donators.length; i++) {
            uint256 donation = campaign.donations[i];
            if (donation > 0) {
                _sendFunds(payable(campaign.donators[i]), donation);
                campaign.donations[i] = 0;
            }
        }
        campaign.currentAmount = 0;
    }

    /*
     * Funktion: deleteCampaign
     * Zweck: Löscht eine Kampagne. Falls Gelder vorhanden sind, werden diese mittels _refundAll an alle Spender zurückerstattet.
     * Einschränkung: Nur der Kampagnenersteller kann diese Funktion aufrufen.
     */
    function deleteCampaign(
        uint256 _id
    ) external onlyOwner(_id) onlyActiveCampaign(_id) nonReentrant {
        Campaign storage campaign = campaigns[_id];
        if (campaign.currentAmount > 0) {
            _refundAll(_id);
        }
        campaign.status = 3; //Status: Kampagne gelöscht
    }

    /*
     * Funktion: getDonators
     * Zweck: Gibt die Listen der Spender und deren entsprechenden Spendenbeträge für eine Kampagne zurück.
     */
    function getDonators(
        uint256 _id
    ) external view returns (address[] memory, uint256[] memory) {
        return (campaigns[_id].donators, campaigns[_id].donations);
    }

    /*
     * Funktion: getCampaigns
     * Zweck: Gibt ein Array aller erstellten Kampagnen zurück.
     */
    function getCampaigns() external view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](numberOfCampaigns);
        for (uint256 i = 0; i < numberOfCampaigns; i++) {
            Campaign storage item = campaigns[i];
            allCampaigns[i] = item;
        }
        return allCampaigns;
    }
}
