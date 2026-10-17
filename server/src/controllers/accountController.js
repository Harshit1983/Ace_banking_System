import Account from "../models/Account.js";

export const getMyAccount = async (req, res) => {
  try {
    // Use the authenticated user's ID, not an ID supplied by the client.
    const account = await Account.findOne({
      userId: req.user.id,
    }).select("-__v");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Bank account not found",
      });
    }

    return res.status(200).json({
      success: true,
      account: {
        accountNo: account.accountNo,
        accountType: account.accountType,
        balancePaise: account.balancePaise,
        balanceRupees: account.balancePaise / 100,
        status: account.status,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    console.error("Get account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your account",
    });
  }
};

export const getMyBalance = async (req, res) => {
  try {
    const account = await Account.findOne({
      userId: req.user.id,
    }).select("accountNo balancePaise status");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Bank account not found",
      });
    }

    return res.status(200).json({
      success: true,
      accountNo: account.accountNo,
      balancePaise: account.balancePaise,
      balanceRupees: account.balancePaise / 100,
      status: account.status,
    });
  } catch (error) {
    console.error("Get balance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your balance",
    });
  }
};