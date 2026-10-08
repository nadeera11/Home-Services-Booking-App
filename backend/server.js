const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const connectDB = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const providerRoutes = require("./routes/providerRoutes");

const app = express();

app.use(cors());
// Increase JSON payload limit to handle base64 image strings from Expo ImagePicker
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "FixMate Home Services Booking API is running",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/provider", providerRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  // Booking writes must not start before the double-booking protection exists.
  await require("./models/Booking").init();
  await require('./models/Complaint').init();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(() => {
  console.error("Backend startup stopped: database connection failed. Check backend/.env and MongoDB access.");
  process.exitCode = 1;
});
