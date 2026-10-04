const User = require("../models/User");

const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: "Please login first"
      });
    }

    const user = await User.findById(req.session.userId).select(
      "_id username email online lastSeen"
    );

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        message: "User account not found"
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(500).json({
      message: "Authentication failed"
    });
  }
};

module.exports = requireAuth;