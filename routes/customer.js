const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');

const isAuthenticated = require('../middlewares/auth');

const Customer = require('../models/customer');
const Order = require('../models/order');
const Measurement = require('../models/Measurement');
const User = require('../models/Users');
const OutfitSelection = require('../models/OutfitSelection');

// Generate PDF Summary
router.get('/order/pdf/:id', isAuthenticated, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    const measurement = await Measurement.findOne({ userId: req.session.user.id }).sort({ createdAt: -1 });

    if (!order || !measurement) return res.status(404).send('Order or measurements not found.');

    const doc = new PDFDocument();
    res.setHeader('Content-disposition', 'attachment; filename=order-summary.pdf');
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).text('Order Summary', { align: 'center' });
    doc.moveDown().text(`Order ID: ${order._id}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Delivery Date: ${order.dateToFinish ? order.dateToFinish.toDateString() : 'Not set'}`);
    doc.moveDown().text('Measurements:', { underline: true });

    for (let key in measurement.toObject()) {
      if (!['_id', '__v', 'userId', 'createdAt', 'updatedAt', 'outfitId'].includes(key)) {
        doc.text(`${key}: ${measurement[key]}`);
      }
    }

    doc.end();
  } catch (err) {
    res.status(500).send('Error generating PDF: ' + err.message);
  }
});

// Update Order
router.post('/order/update/:id', isAuthenticated, async (req, res) => {
  try {
    const { name, gender, cost, dateToFinish, phoneNumber, status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('Order not found');

    const finalName = name?.trim() || order.name;
    await Order.findByIdAndUpdate(req.params.id, {
      name: finalName,
      gender,
      cost,
      dateToFinish: dateToFinish ? new Date(dateToFinish) : null,
      phoneNumber,
      status
    });

    const measurementFields = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => key.startsWith('measurement_'))
    );

    const measurementUpdate = {};
    for (let [key, value] of Object.entries(measurementFields)) {
      measurementUpdate[key.replace('measurement_', '')] = value;
    }

    const outfitIdMatch = order.measurements?.match(/outfit:\s*([a-f\d]{24})/i);
    const outfitId = outfitIdMatch ? outfitIdMatch[1] : null;

    if (outfitId && Object.keys(measurementUpdate).length > 0) {
      const measurement = await Measurement.findOne({ userId: req.session.user.id, outfitId });
      if (measurement) {
        await Measurement.findByIdAndUpdate(measurement._id, measurementUpdate);
      }
    }

    res.redirect('/customer/orders');
  } catch (err) {
    res.status(500).send('Error updating order/measurements: ' + err.message);
  }
});

// Delete Order
router.post('/order/delete/:id', isAuthenticated, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.redirect('/customer/orders');
  } catch (err) {
    res.status(500).send('Error deleting order: ' + err.message);
  }
});

// Dashboard
router.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('customer/dashboard', { user: req.session.user });
});

// Gender selection
router.get('/select-gender', isAuthenticated, (req, res) => {
  const successMessage = req.query.success || null;
  res.render('customer/select-gender', { user: req.session.user, successMessage });
});

router.get('/measurements', isAuthenticated, (req, res) => {
  res.redirect('/customer/select-gender');
});

// Measurement forms
router.get('/measurements/:gender', isAuthenticated, (req, res) => {
  const gender = req.params.gender;
  res.render(`customer/measurements-${gender}`, { user: req.session.user, gender });
});

// Customize outfit
router.post('/customize', isAuthenticated, (req, res) => {
  const { gender, outfitType } = req.body;
  if (!gender || !outfitType) {
    return res.status(400).send('Gender and Outfit Type are required.');
  }
  res.render('customer/customize-outfit', { user: req.session.user, gender, outfitType });
});

// Save customized outfit
router.post('/save-custom-outfit', isAuthenticated, async (req, res) => {
  const { gender, outfitType, clothType, color, pattern } = req.body;

  if (!gender || !outfitType || !clothType) {
    return res.status(400).render('customer/customize-outfit', {
      errorMessage: 'Please fill in all required outfit details.',
      gender, outfitType, clothType, color, pattern, user: req.session.user
    });
  }

  try {
    const outfit = await OutfitSelection.create({
      userId: req.session.user.id,
      gender, outfitType, clothType, color, pattern
    });
    res.redirect(`/customer/add-measurements-${gender}?outfitId=${outfit._id}`);
  } catch (err) {
    res.status(500).render('customer/customize-outfit', {
      errorMessage: '❌ Error saving outfit: ' + err.message,
      gender, outfitType, clothType, color, pattern, user: req.session.user
    });
  }
});

// Add measurement forms
['male', 'female', 'kids', 'kids-boy', 'kids-girl'].forEach(type => {
  router.get(`/add-measurements-${type}`, isAuthenticated, (req, res) => {
    res.render(`customer/add-measurements-${type}`, {
      outfitId: req.query.outfitId || '',
      user: req.session.user
    });
  });
});

// Add measurements and auto-create order
router.post('/add-measurements', isAuthenticated, async (req, res) => {
  try {
    const { outfitId, gender, ...fields } = req.body;
    const measurementData = { userId: req.session.user.id, gender, outfitId };

    for (let key in fields) {
      if (fields[key]) measurementData[key] = fields[key];
    }

    const measurement = new Measurement(measurementData);
    await measurement.save();

    await Order.create({
  userId: req.session.user.id,
  name: req.body.name, // Accept from form
  gender,
  product: 'Custom Outfit',
  measurements: `Auto entry from outfit: ${outfitId}`,
  status: 'Pending'
});

    res.redirect('/customer/orders');
  } catch (err) {
    res.status(500).send('Error saving measurements: ' + err.message);
  }
});

// Order History View
router.get('/orders', isAuthenticated, async (req, res) => {
  try {
    const query = req.query.q || '';
    const searchRegex = new RegExp(query, 'i');

    const orders = await Order.find({
      userId: req.session.user.id,
      $or: [
        { name: searchRegex },
        { product: searchRegex },
        { status: searchRegex }
      ]
    }).sort({ createdAt: -1 });

    const measurements = await Measurement.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
    const outfitMap = {};

    for (const order of orders) {
      const outfitId = order.measurements?.match(/outfit:\s*([a-f\d]{24})/i)?.[1];
      if (outfitId && !outfitMap[outfitId]) {
        const outfit = await OutfitSelection.findById(outfitId);
        outfitMap[outfitId] = outfit ? outfit.outfitType : 'Custom Outfit';
      }
    }

    res.render('order_history', {
      user: req.session.user,
      orders,
      measurements,
      outfitMap,
      searchQuery: query
    });
  } catch (err) {
    res.status(500).send('Error fetching orders: ' + err.message);
  }
});

// Edit measurement
router.get('/measurement/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const measurement = await Measurement.findById(req.params.id);
    if (!measurement || measurement.userId.toString() !== req.session.user.id) {
      return res.status(403).send('Unauthorized');
    }
    res.render('customer/edit-measurement', { measurement, user: req.session.user });
  } catch (err) {
    res.status(500).send('Error loading edit form: ' + err.message);
  }
});

// Profile
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const customer = await Customer.findById(req.session.user.id);
    res.render('customer/profile', { user, customer });
  } catch (err) {
    res.status(500).send('Error loading profile: ' + err.message);
  }
});

router.post('/profile', isAuthenticated, async (req, res) => {
  const { email, phone, address } = req.body;
  try {
    await User.findByIdAndUpdate(req.session.user.id, { email, phone, address });
    res.redirect('/customer/profile');
  } catch (err) {
    res.status(500).send('Error updating profile: ' + err.message);
  }
});

// Change password
router.post('/change-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).send('Please provide current and new password.');
  }

  try {
    const user = await User.findById(req.session.user.id);
    const match = await bcrypt.compare(currentPassword, user.password);

    if (!match) {
      return res.status(400).send('❌ Current password is incorrect.');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.send('✅ Password changed successfully.');
  } catch (err) {
    res.status(500).send('Error changing password: ' + err.message);
  }
});
// Kids type view
router.get('/measurements/kids-type', isAuthenticated, (req, res) => {
  res.render('customer/measurements-kids-type');
});

module.exports = router;
