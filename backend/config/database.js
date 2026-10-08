const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fixmate";
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB connected to database: ${conn.connection.name}`);
  } catch (error) {
    // Do not print connection strings or credentials in startup errors.
    console.error(`MongoDB connection failed (${error.name}).`);
    throw error;
  }
};

module.exports = connectDB;
