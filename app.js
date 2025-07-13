require("dotenv").config(); // ✅ Load environment variables

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");

const app = express();

// ✅ Debug check for MONGO_URI
console.log("🔍 Mongo URI:", process.env.MONGO_URI);

// ✅ MongoDB Atlas connection using environment variable
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => console.log("❌ MongoDB connection error:", err));

// ✅ Session setup
app.use(session({
  secret: 'tailor-secret-key',
  resave: false,
  saveUninitialized: false,
}));

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// ✅ Routes
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');

// ❌ Remove orderRoutes since everything is in /customer
// const orderRoutes = require("./routes/order");
// app.use("/order", orderRoutes); ❌ DELETE THIS

app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/customer', customerRoutes);

// ✅ Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
