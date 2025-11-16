const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret';
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in ms

// ===================================
// VALIDATE TOKEN + AUTO REFRESH
// ===================================
router.post('/validate-token', async (req, res) => {
  const { token } = req.body;

  try {
    // Step 1: Decode and verify the token
    const payload = jwt.verify(token, JWT_SECRET);

    // Step 2: Fetch user to validate jwtVersion
    const user = await User.findOne({ id: payload.userId }).select('+jwtVersion');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Step 3: Reject if version mismatch (i.e., user was forcibly logged out)
    if (payload.jwtVersion !== user.jwtVersion) {
      return res.status(401).json({ message: 'Token invalid (version mismatch)' });
    }

    // Step 4: Check if session is expired based on login time
    const inactiveSince = Date.now() - new Date(user.loginTime).getTime();
    if (inactiveSince > SESSION_TIMEOUT) {
      user.logoutTime = new Date();
      await user.save();
      return res.status(401).json({ message: 'Session expired' });
    }

    // Step 5: Re-issue new token with same jwtVersion
    const newToken = jwt.sign(
      { userId: user.id, role: user.role, jwtVersion: user.jwtVersion },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token: newToken });
  } catch (err) {
    // Token is invalid, tampered, or expired
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// ===================================
// CHECK INACTIVITY (used by front-end polling)
// ===================================
router.post('/check-inactivity', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Compare loginTime with 1 hour threshold
    const oneHourAgo = new Date(Date.now() - SESSION_TIMEOUT);

    // If inactive AND not already logged out, mark as logged out
    if (user.loginTime && user.loginTime < oneHourAgo && !user.logoutTime) {
      user.logoutTime = new Date();
      await user.save();
      return res.status(401).json({ message: 'Session expired due to inactivity' });
    }

    res.status(200).json({ message: 'Session active' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;