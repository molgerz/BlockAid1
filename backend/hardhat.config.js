require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  networks: {
    hardhat: {
      chainId: 31337
    },
    local: {
      url: "http://127.0.0.1:8545", // Verbindung zur lokalen Blockchain
      accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"]
    }
  },
  solidity: "0.8.20",
};