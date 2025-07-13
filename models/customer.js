const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Optional additional fields
  preferences: String,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
