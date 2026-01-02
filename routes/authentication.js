const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/userModel'); // This import is correct

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret';

// --- MIDDLEWARE FUNCTION TO PROTECT ROUTES ---
const protectRoute = async (req, res, next) => {
  console.log("\n--- protectRoute: A new request came in. ---");
  try {
    // 1. Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('No token provided');
    }
    console.log("--- protectRoute: Token found.");

    // 2. Verify the token
    const payload = jwt.verify(token, JWT_SECRET);
    console.log("--- protectRoute: Token is valid. Payload:", payload);

    // 3. Find the user from the token payload (This is correct)
    const user = await User.findOne({ _id: payload.userId });
    console.log("--- protectRoute: Database search for user:", user ? user.full_name : "NOT FOUND");

    if (!user) {
      throw new Error('User not found');
    }

    // 4. Attach user to the request object
    req.user = user;
    console.log("--- protectRoute: SUCCESS. Handing off to the main route.");
    
    next(); // Proceed to the route handler
  } catch (error) {
    console.log("--- protectRoute: FAILED. Sending 401 Error:", error.message);
    res.status(401).json({ message: 'Please authenticate.', error: error.message });
  }
};

// ===================================
// VALIDATE TOKEN ROUTE (Corrected)
// ===================================
router.post('/validate-token', async (req, res) => {
  const { token } = req.body;

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Step 2: Fetch user (Corrected)
    const user = await User.findOne({ _id: payload.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Step 3: jwtVersion check has been REMOVED

    // Step 4: Re-issue new token (Corrected)
    const newToken = jwt.sign(
      { userId: user._id, role: user.role }, // Removed jwtVersion
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// --- UPDATED EXPORT ---
module.exports = {
  authRouter: router,
  protectRoute: protectRoute
};