# Stellar-Micro-Donation-API
# Clone repo
git clone <repo-url>
cd stellar-micro-donations

# Install dependencies
npm install

# Set up environment variables in .env
# Example:
# STELLAR_SECRET=...
# STELLAR_NETWORK=testnet

# Initialize database
node scripts/initDB.js

# Run server
node src/app.js
