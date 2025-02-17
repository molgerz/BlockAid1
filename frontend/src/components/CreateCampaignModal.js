import React, { useState } from 'react'

const inputStyle = {
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  fontSize: "1rem"
}

const buttonStyle = {
  padding: "8px 16px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer"
}

const CreateCampaignModal = ({ isOpen, onClose, onCreateCampaign }) => {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [goal, setGoal] = useState("")
  const [deadline, setDeadline] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = () => {
    if (!title || !description || !image || !goal || !deadline) {
      setError("Bitte alle Felder ausfüllen!")
      return
    }
    try {
      new URL(image)
    } catch (err) {
      setError("Bild-URL muss eine gültige URL sein!")
      return
    }
    // Überprüfe, ob das Datum mindestens 24 Stunden in der Zukunft liegt
    const now = new Date();
    const minDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Jetzt + 24 Stunden
    const deadlineDate = new Date(deadline);
    if (deadlineDate < minDeadline) {
      setError("Die Deadline muss mindestens 24 Stunden in der Zukunft liegen!");
      return;
    }
    setError("")
    onCreateCampaign({ title, description, image, goal, deadline })
    setTitle("")
    setDescription("")
    setImage("")
    setGoal("")
    setDeadline("")
    onClose() 
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "12px",
        maxWidth: "500px",
        width: "100%",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
      }}>
        <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Kampagne erstellen</h2>
        {error && <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="Titel"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Beschreibung"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <input
            type="text"
            placeholder="Bild-URL"
            value={image}
            onChange={e => setImage(e.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="Zielbetrag (ETH)"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            style={inputStyle}
          />
          <input
            type="date"
            placeholder="Deadline"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{
          marginTop: "20px",
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px"
        }}>
          <button
            onClick={onClose}
            style={{ ...buttonStyle, backgroundColor: "#ccc", color: "#000" }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            style={{ ...buttonStyle, backgroundColor: "#4caf50", color: "#fff" }}
          >
            Jetzt erstellen
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateCampaignModal