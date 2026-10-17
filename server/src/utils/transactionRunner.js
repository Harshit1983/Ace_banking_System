import mongoose from "mongoose";

/**
 * Checks whether the current MongoDB deployment supports multi-document transactions.
 * Multi-document transactions require a replica set or sharded cluster.
 */
export const supportsTransactions = () => {
  const topology = mongoose.connection.client?.topology?.description;
  return Boolean(topology?.setName);
};

/**
 * Executes a unit of work inside a MongoDB transaction when running against a replica set,
 * or runs the work sequentially when running on a standalone development instance.
 *
 * @param {Function} workFn - Callback `async (session) => result`. `session` is null when running standalone.
 * @returns {Promise<any>}
 */
export const runTransaction = async (workFn) => {
  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  

  // Fallback for standalone MongoDB instances
  return await workFn(null);
};
