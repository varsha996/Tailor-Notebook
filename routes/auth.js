const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/Users');
const rateLimit = require('express-rate-limit');

// Limit login attempts (5 attempts per 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Try again in 15 minutes.',
});


// Strong password validation function
const isStrongPassword = (password) => {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return strongRegex.test(password);
};


// Signup GET
router.get('/signup', (req, res) => {
  res.render('auth', { isLogin: false});
});


// Login GET
router.get('/login', (req, res) => {
  res.render('auth', { isLogin: true});
});


// Signup POST
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.send('Username already taken');
    if (!isStrongPassword(password)) {
      return res.send('❌ Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });

    await newUser.save();

    // Auto-login after signup
    req.session.user = {
      id: newUser._id,
      username: newUser.username
    };

    res.redirect('/customer/dashboard');
  } catch (err) {
    res.send('Error during signup: ' + err.message);
  }
});


// Login POST
router.post('/login',loginLimiter,async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const user = await User.findOne({ username });
      if (!user) return res.send('User not found');
  
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.send('Invalid password');
  
      // Save user in session
      req.session.user = {
        id: user._id,
        username: user.username
      };
  
      // Redirect to dashboard (e.g., /orders)
      res.redirect('/customer/dashboard');
    } catch (err) {
      res.send('Error during login: ' + err.message);
    }
  });

  
  // Check if username exists (used for signup validation)
router.get('/check-username', async (req, res) => {
  const { username } = req.query;
  try {
    const existingUser = await User.findOne({ username });
    res.json({ exists: !!existingUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

  

module.exports = router;
