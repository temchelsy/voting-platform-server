import jwt from "jsonwebtoken";
import User from "../models/user.js";

const auth = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    console.warn("No token provided in Authorization header.");
    return res.status(401).json({ error: "Authentication required", details: "No token provided" });
  }

  console.log("Received Token:", token);

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure `decoded.user` exists and fetch user from the database
    if (!decoded?.user?.id) {
      console.error("Decoded token does not contain user id:", decoded);
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const user = await User.findById(decoded.user.id);
    if (!user) {
      console.warn(`User not found for ID: ${decoded.user.id}`);
      return res.status(401).json({ error: "User not found" });
    }

    console.log(`Authenticated User: ${user.email} (ID: ${user._id})`);

    // Exclude sensitive data like password before attaching to `req.user`
    const { password, ...restUser } = user.toObject();
    req.user = { ...restUser, id: restUser._id };

    next();
  } catch (err) {
    console.error("Authentication error:", err.message);
    return res.status(401).json({ error: "Invalid token", details: err.message });
  }
};

export default auth;
