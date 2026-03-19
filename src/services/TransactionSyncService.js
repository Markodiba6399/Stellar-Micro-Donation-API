/**
 * Transaction Sync Service - Blockchain Data Synchronization
 * 
 * RESPONSIBILITY: Synchronizes transactions from Stellar Horizon API to local database
 * OWNER: Backend Team
 * DEPENDENCIES: StellarService, Horizon API, Transaction model
 * 
 * Fetches transaction history from Stellar network and creates local records for new
 * transactions, ensuring local database reflects blockchain state.
 */

const StellarSdk = require('stellar-sdk');

// Internal modules
const Transaction = require('../routes/models/transaction');
const { HORIZON_URLS } = require('../constants');

class TransactionSyncService {
  /**
   * Create a new TransactionSyncService instance
   * @param {Object} stellarService - Stellar service instance
   * @param {string} [horizonUrl] - Horizon server URL (optional)
   */
  constructor(stellarService, horizonUrl = HORIZON_URLS.TESTNET) {
    // Support calling with just a URL string, or no args
    if (typeof stellarService === 'string') {
      horizonUrl = stellarService;
      stellarService = null;
    }
    this.stellarService = stellarService || null;
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
  }

  /**
   * Sync wallet transactions from Stellar network to local database
   * Fetches transactions from Horizon and creates local records for new ones
   * @param {string} publicKey - Stellar public key to sync
   * @returns {Promise<{synced: number, transactions: Array}>} Sync results
   */
  async syncWalletTransactions(publicKey) {
    const horizonTxs = await this._fetchHorizonTransactions(publicKey);
    const syncedTxs = [];

    for (const tx of horizonTxs) {
      const existing = Transaction.getByField('stellarTxId', tx.id);
      if (!existing) {
        const newTx = Transaction.create({
          stellarTxId: tx.id,
          status: 'confirmed',
          amount: tx.amount,
          memo: tx.memo,
          timestamp: tx.created_at,
        });
        syncedTxs.push(newTx);
      }
    }

    return { synced: syncedTxs.length, transactions: syncedTxs };
  }

  async _fetchHorizonTransactions(publicKey) {
    try {
      const response = await this.server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(50)
        .call();
      return response.records || [];
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return [];
      }
      throw error;
    }
  }

  _extractAmount(tx) {
    return (tx.operations && tx.operations[0] && tx.operations[0].amount) || '0';
  }

  _extractSource(tx) {
    return tx.source_account || null;
  }

  _extractDestination(tx) {
    return (tx.operations && tx.operations[0] && tx.operations[0].destination) || tx.source_account || null;
  }
}

module.exports = TransactionSyncService;
