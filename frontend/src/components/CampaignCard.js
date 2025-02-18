import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import ProgressBar from './ProgressBar'

const CampaignCard = ({ campaign, account, donateToCampaign, deleteCampaign, claimRefund, withdrawFunds, contract }) => {
    // Berechne die aktuelle Zeit in Sekunden
    const now = Date.now() / 1000; /* Änderung: Jetzt in Sekunden */
    // Prüfe, ob die Deadline erreicht wurde
    const deadlineReached = now >= Number(campaign.deadline);
    // Prüfe, ob das Ziel erreicht wurde
    const targetReached = Number(campaign.currentAmount) >= Number(campaign.goal);
    // Lokaler State zur Speicherung des anzuzeigenden Betrags
    const [displayedAmount, setDisplayedAmount] = useState(BigInt(campaign.currentAmount.toString()));

    // Diese useEffect-Funktion queryt die Blockchain nach DonationReceived-Events 
    // für die aktuelle Kampagne und aktualisiert den lokalen State (displayedAmount)
    // mit dem zuletzt gemeldeten gespendeten Betrag.
    useEffect(() => {
        async function fetchDonationEvents() {
            if (contract && campaign.id !== undefined) {
                try {
                    console.log("Fetching donation events for campaign.id:", campaign.id);
                    // Erstelle den Filter – so dass der Event-Parameter exakt übereinstimmt
                    const filter = contract.filters.DonationReceived(campaign.id); // vorausgesetzt, campaign.id ist schon passend formatiert
                    const events = await contract.queryFilter(filter);
                    console.log("Gefundene Events:", events);
                    if (events.length > 0) {
                        // Nehme den letzten Event (angenommen, er enthält den kumulierten Wert)
                        const lastEvent = events[events.length - 1];
                        console.log("Letzter Event currentAmount:", lastEvent.args.currentAmount.toString());
                        setDisplayedAmount(lastEvent.args.currentAmount);
                    } else {
                        // Falls keine Events gefunden wurden, nutze den Fallback nur, wenn die Kampagne noch aktiv ist (Status 0)
                        console.log("Keine Events gefunden – Fallback. campaign.status:", campaign.status);
                        if (Number(campaign.status) === 0) {
                            setDisplayedAmount(campaign.currentAmount.toString());
                        }
                    }
                } catch (error) {
                    console.error("Fehler beim Abrufen der Donation-Events:", error);
                    // Bei einem Fehler ebenfalls nur fallback nutzen, wenn Kampagne aktiv ist
                    if (Number(campaign.status) === 0) {
                        setDisplayedAmount(campaign.currentAmount.toString());
                    }
                }
            }
        }
        fetchDonationEvents();
    }, [contract, campaign.id, campaign.currentAmount, campaign.status]);

    // Status-Badge-Logik: Der Status im Contract (campaign.status) dient nur als Validierung, nicht zur direkten Anzeige
    let statusText = "";
    let statusColor = "";
    if (Number(campaign.status) === 0) {
        if (!deadlineReached && !targetReached) {
            statusText = "Offen"; // Kampagne aktiv, Deadline und Ziel noch nicht erreicht 
            statusColor = "blue";
        } else if (deadlineReached && !targetReached) {
            statusText = "Fehlgeschlagen"; // Deadline erreicht, Ziel nicht erreicht 
            statusColor = "red";
        } else if (targetReached) {
            statusText = "Erfolgreich"; // Ziel erreicht 
            statusColor = "green";
        }
    } else if (Number(campaign.status) === 1) {
        statusText = "Ausgezahlt"; // Bei erfolgreicher Kampagne wurde bereits ausgezahlt
        statusColor = "green";

    } else if (Number(campaign.status) === 2) {
        statusText = "Refund durchgeführt"; // Bei fehlgeschlagener Kampagne wurde bereits refunded 
        statusColor = "red";

    } else if (Number(campaign.status) === 3) {
        statusText = "Gelöscht"; // Kampagne gelöscht 
        statusColor = "grey";
    }

    return (
        <div style={{
            position: "relative",
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "12px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            backgroundColor: "#fff",
            overflow: "hidden"
        }}>
            {/* Status-Badge in der oberen linken Ecke */}
            <div style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                backgroundColor: statusColor,
                color: "#fff",
                padding: "4px 8px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                opacity: 0.8,
            }}>
                {statusText}
            </div>

            {/* Kampagnen-Titel */}
            <h3 style={{ marginTop: "10px", paddingTop: "20px" }}>{campaign.title}</h3>

            {/* Beschreibung */}
            <div style={{ marginTop: "-10px", color: "#666", whiteSpace: "pre-wrap", textAlign: "justify" }}>
                <p>{campaign.description}</p>
            </div>

            {/* Kampagnenbild – Vollbreite, zentriert und abgerundete Ecken */}
            {campaign.image && (
                <img
                    src={campaign.image}
                    alt={campaign.title}
                    style={{
                        width: "100%",
                        display: "block",
                        margin: "0 auto",
                        borderRadius: "12px", /* Änderung: Ganze Box abgerundet */
                        objectFit: "cover"
                    }}
                    onError={(e) => e.target.style.display = "none"}
                />
            )}

            {/* Direkt unter dem Bild: ProgressBar */}
            <div style={{ marginTop: "10px" }}>
                <ProgressBar
                    current={BigInt(displayedAmount)}
                    goal={BigInt(campaign.goal.toString())}
                />
            </div>

            {/* Beträge: Gesammelt und Ziel */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px", fontSize: "0.9rem" }}>
                <span><strong>Gesammelt:</strong> {ethers.formatEther(BigInt(displayedAmount.toString()))} ETH</span>
                <span><strong>Ziel:</strong> {ethers.formatEther(BigInt(campaign.goal.toString()))} ETH</span>
            </div>

            {/* Deadline – nur Datum, ohne Uhrzeit */}
            <p style={{ marginTop: "5px", fontSize: "0.9rem" }}>
                <strong>Deadline:</strong> {new Date(Number(campaign.deadline) * 1000).toLocaleDateString()}
            </p>

            {/* Aktionsbereich */}
            {(() => {
                if (Number(campaign.status) !== 0) return null;

                // Fall 1: Offen – Deadline nicht erreicht und Ziel nicht erreicht
                if (!deadlineReached && !targetReached) {
                    return (
                        <div style={{ marginTop: "10px" }}>
                            <input
                                type="number"
                                placeholder="Betrag (ETH)"
                                id={`donation-${campaign.id}`}
                                style={{
                                    padding: "6px",
                                    borderRadius: "6px",
                                    border: "1px solid #ccc",
                                    marginRight: "8px",
                                    width: "120px"
                                }}
                            />
                            <button
                                onClick={() => donateToCampaign(campaign.id)}
                                style={{
                                    padding: "8px 12px",
                                    backgroundColor: "#4caf50",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    marginRight: "8px"
                                }}
                            >
                                Spenden
                            </button>
                            {account && account.toLowerCase() === campaign.owner.toLowerCase() && (
                                <button
                                    onClick={() => deleteCampaign(campaign.id)}
                                    style={{
                                        padding: "8px 12px",
                                        backgroundColor: "#f44336",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Kampagne löschen
                                </button>
                            )}
                        </div>
                    );
                }
                // Fall 2: Fehlgeschlagen – Deadline erreicht und Ziel nicht erreicht
                if (deadlineReached && !targetReached) {
                    const isDonor = account && campaign.donators.some(donor => donor.toLowerCase() === account.toLowerCase());
                    if (isDonor) {
                        return (
                            <div style={{ marginTop: "10px" }}>
                                <button
                                    onClick={() => claimRefund(campaign.id)}
                                    style={{
                                        padding: "8px 12px",
                                        backgroundColor: "#2196F3",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Refund anfordern
                                </button>
                            </div>
                        );
                    } else {
                        return (
                            <p style={{ marginTop: "10px", fontStyle: "italic" }}>
                                Refunds können nur von Spendern angefordert werden.
                            </p>
                        );
                    }
                }
                // Fall 3: Erfolgreich – Ziel erreicht (unabhängig von Deadline)
                if (targetReached) {
                    if (account && account.toLowerCase() === campaign.owner.toLowerCase()) {
                        return (
                            <div style={{ marginTop: "10px" }}>
                                <button
                                    onClick={() => withdrawFunds(campaign.id)}
                                    style={{
                                        padding: "8px 12px",
                                        backgroundColor: "#4caf50",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Auszahlung
                                </button>
                            </div>
                        );
                    } else {
                        return null;
                    }
                }
                return null;
            })()}
        </div>
    );
}

export default CampaignCard;