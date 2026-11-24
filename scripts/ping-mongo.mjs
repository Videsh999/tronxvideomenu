import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI missing");
  process.exit(1);
}

console.log("connecting…");
const hard = setTimeout(() => {
  console.error("HARD_TIMEOUT");
  process.exit(2);
}, 15000);

try {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  clearTimeout(hard);
  const n = await mongoose.connection.db.collection("restaurants").countDocuments();
  console.log("OK restaurants=", n);
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  clearTimeout(hard);
  console.error("FAIL", error?.message || error);
  process.exit(1);
}
