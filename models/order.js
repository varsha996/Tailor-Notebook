const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  product: String,
  measurements: String,
  name: String,
  gender: String,
  cost: Number,
  dateToFinish: Date,
  phoneNumber: String,
  status: {
    type: String,
    enum: ["Pending", "Done", "Delivered"],
    default: "Pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);
