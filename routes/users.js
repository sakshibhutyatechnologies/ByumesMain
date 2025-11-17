const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, ROLES, LANGUAGES, TIMEZONES } = require('../models/userModel');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret';
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;

// GET ALL USERS (For Approver Dropdown)

// GET ALL USERS
router.get('/', async (req, res) => {
  try {
    // Added 'loginId' and 'email' to the list of fields to fetch
    const users = await User.find({}, '_id loginId full_name email role status')
      .sort({ full_name: 1 }); 
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});
// ENUMS
router.get('/enums', (req, res) => {
  res.json({ roles: ROLES, languages: LANGUAGES, timezones: TIMEZONES });
});

// REGISTER
router.post('/register', async (req, res) => {
  const { loginId, full_name, email, password, role, language, timezone, companyId, status = 'active', profile_picture_url = '', requesterRole } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { loginId }] });
    if (existingUser) return res.status(400).json({ message: 'User exists' });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new User({
      loginId, full_name, email, password: hashedPassword, role, language, timezone, 
      companyId: Number(companyId), status, profile_picture_url 
    });
    await user.save();
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { loginId, password } = req.body;
  try {
    const user = await User.findOne({ loginId }).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    user.last_login_at = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    
    res.json({
      token,
      user: {
        loginId: user.loginId,
        full_name: user.full_name,
        role: user.role,
        email: user.email,
        status: user.status,
        userId: user._id,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// LOGOUT
router.post('/logout', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
        user.logoutTime = new Date();
        await user.save();
    }
    res.json({ message: 'Logout successful' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// UPDATE USER
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ message: 'User updated', user: updatedUser });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;