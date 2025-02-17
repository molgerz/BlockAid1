import React from 'react'

const ProgressBar = ({ current, goal }) => {
  // Prozentwert berechnen und zwischen 0 und 100 clampen
  const percentage = Math.min(100, Math.max(0, (current / goal) * 100))
  const p = percentage / 100

  // Startfarbe (bei 0%) = #f44336 -> (244,67,54)
  // Endfarbe (bei 100%) = #4caf50 -> (76,175,80)
  const startColor = { r: 244, g: 67, b: 54 }
  const endColor = { r: 76, g: 175, b: 80 }

  const r = Math.floor(startColor.r + p * (endColor.r - startColor.r))
  const g = Math.floor(startColor.g + p * (endColor.g - startColor.g))
  const b = Math.floor(startColor.b + p * (endColor.b - startColor.b))

  const color = `rgb(${r}, ${g}, ${b})`

  return (
    <div style={{
      width: "100%",
      backgroundColor: "#ddd",
      borderRadius: "4px",
      overflow: "hidden",
      position: "relative"
    }}>
      <div style={{
        width: `${percentage}%`,
        backgroundColor: color,
        height: "20px",
        transition: "width 0.5s ease-in-out"
      }} />
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        color: "#000"
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  )
}

export default ProgressBar