const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gender: String,
  outfitType: String,
  clothType: String,
  color: String,
  pattern: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OutfitSelection', outfitSchema);
