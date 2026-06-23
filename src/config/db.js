import mongoose from "mongoose";
import dns from "dns";

// Set DNS servers for better resolution
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      family: 4, // Force IPv4, skip IPv6
      // SSL/TLS options to fix the SSL error
      tls: true,
      tlsAllowInvalidCertificates: true, // Allow invalid certificates
      tlsAllowInvalidHostnames: true, // Allow invalid hostnames
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    console.log(
      `✅ MongoDB connected successfully to: ${conn.connection.host}`,
    );
    console.log(`📊 Database: ${conn.connection.name}`);

    // Handle connection errors after initial connection
    mongoose.connection.on("error", (err) => {
      console.error(
        "❌ MongoDB connection error after initial connection:",
        err,
      );
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected, attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully");
    });

    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.log("🔄 Retrying connection in 5 seconds...");

    // Retry connection after 5 seconds
    setTimeout(() => {
      connectDB();
    }, 5000);

    throw error;
  }
};

export default connectDB;
