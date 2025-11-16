const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, ROLES, LANGUAGES, TIMEZONES } = require('../models/userModel');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret';

// Pull bcrypt cost factor from env (default 10)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;

// Expose ENUMS via API
router.get('/enums', (req, res) => {
  res.json({
    roles: ROLES,
    languages: LANGUAGES,
    timezones: TIMEZONES
  });
});

// REGISTER NEW USER (Admin only)
router.post('/register', async (req, res) => {
  const {
    loginId,
    full_name,
    email,
    password,
    role,
    language,
    timezone,
    companyId,
    status = 'active',
    profile_picture_url = '',
    requesterRole
  } = req.body;

  if (requesterRole !== 'Admin') {
    return res.status(403).json({ message: 'Only Admin can create users' });
  }

  try {
    // Ensure uniqueness
    const existingUser = await User.findOne({ $or: [{ email }, { loginId }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or loginId already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new user
    const user = new User({
      loginId,
      full_name,
      email,
      password: hashedPassword,
      role,
      language,
      timezone,
      companyId: Number(companyId),
      status,
      profile_picture_url,
      last_login_at: null,
      loginTime: null,
      logoutTime: null
    });

    await user.save();

    res.status(201).json({ message: 'User created successfully', user });
  } catch (err) {
    console.error('Register error:', err);
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
    user.loginTime = new Date();
    user.logoutTime = null;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        loginId: user.loginId,
        full_name: user.full_name,
        role: user.role,
        language: user.language,
        timezone: user.timezone,
        email: user.email,
        companyId: user.companyId,
        profile_picture_url: user.profile_picture_url,
        status: user.status,
        created_at: user.created_at,
        userId: user._id,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// LOGOUT
router.post('/logout', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.logoutTime = new Date();
    await user.save();

    res.json({ message: 'Logout successful' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// UPDATE USER PASSWORD (Admin only)
router.put('/password/:userId', async (req, res) => {
  const { userId } = req.params;
  const { newPassword, requesterRole } = req.body;

  if (requesterRole !== 'Admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const user = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true, select: false }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/change-password', async (req, res) => {
  const { loginId, oldPassword, newPassword } = req.body;
  try {
    // pull the Mongo _id straight from the JWT
    const user = await User.findOne({ loginId }).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // verify the old password
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    // hash & save new password
    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change-password error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// UPDATE USER DETAILS
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated', user: updatedUser });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET ALL USERS
router.get('/', async (req, res) => {
  try {
    const users = await User.find().populate('companyId', 'name');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router;