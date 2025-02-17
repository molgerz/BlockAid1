import React from 'react'
import logo from '../logo.svg'

const HeaderBar = ({ walletAddress, onCreateCampaign, onConnectWallet }) => {
  const headerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    backgroundColor: '#000',
    color: '#fff',
    boxShadow: '0 2px 4px rgba(0 0 0 0.1)',
    zIndex: 1000
  }

  const logoStyle = {
    height: '40px',
    marginRight: '30px',
    filter: 'invert(1)'
  }

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }

  return (
    <header style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <img src={logo} alt="Logo" style={logoStyle} />
        {walletAddress && ( // Button wird nur angezeigt, wenn walletAddress vorhanden ist
          <button style={buttonStyle} onClick={onCreateCampaign}>Kampagne erstellen</button>
        )}
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        {walletAddress ? (
          <span>Wallet: {walletAddress}</span> // Wenn eingeloggt, wird die Wallet-Adresse angezeigt
        ) : (
          <button style={buttonStyle} onClick={onConnectWallet}>Connect Wallet</button> // Andernfalls der Connect Wallet Button
        )}
      </div>
    </header>
  )
}

export default HeaderBar