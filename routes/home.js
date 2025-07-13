const express = require('express');
const router = express.Router();

// Landing Page
router.get('/', (req, res) => {
  res.render('home'); // views/home.ejs
});

module.exports = router;
