import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import dotenv from "dotenv";
import registerValidator from "../utils/registerValidator.js";
import loginValidator from "../utils/loginValidator.js";
import auth from "../middleware/auth.js";
import { uploadToCloudService } from "../CloudService.js";
import multer from "multer";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import passport from "passport";

dotenv.config();
const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, and GIF files are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

router.post("/register", registerValidator, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationTokenExpires = Date.now() + 3600000;

    const user = new User({
      username,
      email,
      password,
      verificationToken,
      verificationTokenExpires,
    });

    await user.save();

    const verificationUrl = `http://localhost:5173/verify-email/${verificationToken}`;

    await transporter.sendMail({
      to: user.email,
      subject: "Email Verification",
      html: `<h2>Email Verification</h2>
             <p>Please click the link below to verify your email:</p>
             <p><a href="${verificationUrl}">Verify Email</a></p>`,
    });

    res.status(201).json({
      msg: "Registration successful! Please check your email to verify your account.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});


router.post("/resend-verification-code", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationTokenExpires = Date.now() + 3600000;
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    const verificationUrl = `http://localhost:5173/verify-email/${verificationToken}`;

    await transporter.sendMail({
      to: user.email,
      subject: "Email Verification",
      html: `<h2>Email Verification</h2>
             <p>Please click the link below to verify your email:</p>
             <p><a href="${verificationUrl}">Verify Email</a></p>`,
    });

    res.json({ message: "New verification email sent successfully" });
  } catch (error) {
    console.error("Error resending verification code:", error);
    res.status(500).json({ message: "Error resending verification code" });
  }
});

router.post("/login", loginValidator, async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const payload = { user: { id: user.id } };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    user.refreshToken = refreshToken;
    await user.save();

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error("Login error:", err);
    next(err);
  }
});

router.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ msg: "Refresh token required" });

  try {
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(401).json({ msg: "Invalid refresh token" });
    }

    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ msg: "Invalid refresh token" });
      }

      const payload = { user: { id: decoded.user.id } };
      const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "7h",
      });

      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/current-user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  async (req, res) => {
    try {
      console.log("Google OAuth Callback - User:", req.user);

      if (!req.user) {
        console.error("No user found in the request");
        return res.status(401).json({
          status: "failed",
          message: "Google authentication failed",
        });
      }

      const token = jwt.sign(
        { user: { id: req.user._id.toString(), email: req.user.email } },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const frontendRedirectURL = `${process.env.FRONTEND_URL}/oauth-callback?token=${token}`;

      console.log("Redirect URL:", frontendRedirectURL);
      res.redirect(frontendRedirectURL);
    } catch (error) {
      console.error("Google OAuth Callback Error:", error);
      res
        .status(500)
        .json({ status: "failed", message: "Internal server error" });
    }
  }
);

router.get("/profile", auth, async (req, res) => {
  console.log("Authenticated User ID:", req.user.id); // Debug log
  try {
    const user = await User.findById(req.user.id).select("email");
    if (!user) {
      console.error("User not found for ID:", req.user.id); // Debug log
      return res.status(404).json({ error: "User not found" });
    }
    console.log("Fetched User:", user); // Debug log
    res.json(user);
  } catch (error) {
    console.error("Server error:", error); // Debug log
    res.status(500).json({ error: "Server error" });
  }
});




router.post(
  "/uploadProfileImage",
  auth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      const filePath = req.file.path;
      const result = await uploadToCloudService(filePath);

      if (!req.user) {
        return res.status(400).json({ message: "User not found." });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.profileImage = result.secure_url;
      await user.save();

      res.json({ url: user.profileImage });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      next(error);
    }
  }
);

router.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred",
  });
});

export default router;
