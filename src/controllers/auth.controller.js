import Prisma from "../db/db.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
} from "../utils/lib.js";
import nodemailer from "nodemailer";

const cookieOptions = {
  httpOnly: true,
  sameSite: "none",
  domain: "airmailo.com",
  secure: true,
};

// sigup public route admin
const signup = asyncHandler(async (req, res) => {
  const { name, email, phone, password, termsAndConditions } = req.body;

  if (
    ![name, email, phone, password, termsAndConditions].every(
      (v) => v && String(v).trim().length > 0
    )
  ) {
    return ApiError.send(res, 400, "All fields are required");
  }

  const exists = await Prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (exists) return ApiError.send(res, 409, "User already exists");

  const hashedPassword = await hashPassword(password);

  const token = jwt.sign(
    { name, email, phone, password: hashedPassword, termsAndConditions },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "2m" }
  );

  const verifyLink = `${process.env.CLIENT_URI}/signup-verify?token=${token}`;

  const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    auth: {
      user: "apikey",
      pass: process.env.SENDGRID_API_KEY,
    },
  });

  await transporter.sendMail({
    to: email,
    from: "no-reply@airmailo.com",
    subject: "Verify your email",
    html: `
  <div style="max-width: 720px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); overflow: hidden; font-family: Arial, sans-serif;">
    
    <div style="background: linear-gradient(to bottom right, #6366f1, #8b5cf6); padding: 40px 30px; text-align: center; color: white;">
      <img src="https://azzunique.com/Images/Logo/09052023135911.png" alt="AzzUnique Software" style="filter: brightness(0) invert(1); max-width: 180px; height: auto; margin-bottom: 20px;" />
      <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px;">Welcome to AirMailo!</h1>
      <p style="font-size: 16px; opacity: 0.9; margin: 0;">Complete your registration to get started</p>
    </div>

    <div style="padding: 40px 30px;">
      <h2 style="font-size: 22px; font-weight: 600; color: #111827; margin-bottom: 24px;">Hello ${name},</h2>

      <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
        Thank you for signing up for AirMailo! We're excited to have you join our platform. To complete your registration and start using all our features, please verify your email address by clicking the button below.
      </p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${verifyLink}" target="_blank" style="background: linear-gradient(to bottom right, #6366f1, #8b5cf6); color: white; padding: 16px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);">
          Verify Email Address
        </a>
      </div>

      <div style="background-color: #fefce8; border: 1px solid #fef3c7; color: #92400e; padding: 16px; border-radius: 8px; margin: 24px 0; display: flex; align-items: center; font-size: 14px;">
        <div style="margin-right: 12px;">
          ⚠️
        </div>
        <div>
          <strong>Important:</strong> This verification link will expire in 2 minutes for security purposes.
        </div>
      </div>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; font-size: 13px; margin: 24px 0;">
        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #1f2937;">Can't click the button?</h3>
        <p style="color: #4b5563; word-break: break-word; line-height: 1.5;">Copy and paste this link into your browser: ${verifyLink}</p>
      </div>

      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; color: #4b5563; font-size: 14px; margin: 24px 0;">
        <strong>Security Notice:</strong> If you didn't create an account with AirMailo, please ignore this email. Your email address will not be added to our system without verification.
      </div>
    </div>

    <div style="background-color: #f9fafb; padding: 32px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">AzzUnique Software Private Limited</div>
      <a href="https://airmailo.com" style="color: #6366f1; text-decoration: none; font-size: 14px;">airmailo.com</a>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <a href="https://azzunique.com" style="color: #6b7280; text-decoration: none; font-size: 12px; margin: 0 12px;">Visit Our Website</a>
        <a href="mailto:support@azzunique.com" style="color: #6b7280; text-decoration: none; font-size: 12px; margin: 0 12px;">Contact Support</a>
      </div>
    </div>

  </div>
  `,
  });

  return res.status(200).json(
    new ApiResponse(200, "Verification email sent", {
      message: "Please check your email to verify your account.",
    })
  );
});

const verifySignup = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) return ApiError.send(res, 400, "Token is required");

  let payload;
  try {
    payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    return ApiError.send(res, 401, "Invalid or expired token");
  }

  const { name, email, phone, password, termsAndConditions } = payload;

  const exists = await Prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (exists) return ApiError.send(res, 409, "User already exists");

  const user = await Prisma.user.create({
    data: {
      name,
      email,
      phone,
      password,
      role: "ADMIN",
      termsAndConditions,
      isActive: true,
      isAuthorized: true,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Account verified and user created", { user }));
});

// login
const login = asyncHandler(async (req, res) => {
  const { emailOrPhone, password } = req.body;
  if (!emailOrPhone || !password) {
    return ApiError.send(res, 400, "Email/Phone and password are required");
  }

  // 1. Try finding in User table (Admin / Super Admin)
  const user = await Prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
    },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      name: true,
    },
  });

  //
  if (!user) {
    const mailbox = await Prisma.mailbox.findFirst({
      where: { emailAddress: emailOrPhone },
    });

    if (!mailbox) return ApiError.send(res, 404, "Mailbox user not found");

    const isPasswordValid = await comparePassword(password, mailbox.password);
    if (!isPasswordValid) return ApiError.send(res, 403, "Password Invalid");

    const updatedMailbox = await Prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = generateAccessToken(
      updatedMailbox.id,
      updatedMailbox.emailAddress,
      "USER"
    );
    const refreshToken = generateRefreshToken(
      updatedMailbox.id,
      updatedMailbox.emailAddress,
      "USER"
    );

    const { password: _, lastLoginAt, ...mailboxSafe } = updatedMailbox;

    return res
      .status(200)
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        domain: "airmailo.com",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        domain: "airmailo.com",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json(
        new ApiResponse(200, "Login successful", {
          ...mailboxSafe,
          role: "USER",
        })
      );
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return ApiError.send(res, 401, "Invalid credentials");
  }

  let userRole = "ADMIN";
  if (user.role === "SUPER_ADMIN") {
    userRole = "SUPER_ADMIN";
  }

  const accessToken = generateAccessToken(user.id, user.email, userRole);
  const refreshToken = generateRefreshToken(user.id, user.email, userRole);

  const { password: _, ...userSafe } = user;

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "airmailo.com",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "airmailo.com",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(
      new ApiResponse(200, "Login successful", {
        ...userSafe,
        role: userRole,
      })
    );
});

// refreshAccessToken
const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return ApiError.send(res, 401, "Refresh token missing");

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    let newAccessToken;

    if (
      decoded.role === "ADMIN" ||
      decoded.role === "SUPER_ADMIN" ||
      decoded.role === "USER"
    ) {
      const user = await Prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true },
      });

      if (!user) return ApiError.send(res, 401, "User not found");

      newAccessToken = generateAccessToken(user.id, user.email, user.role);
    } else {
      const mailbox = await Prisma.mailbox.findUnique({
        where: { id: decoded.id },
        select: { id: true, emailAddress: true },
      });

      if (!mailbox) return ApiError.send(res, 401, "Mailbox not found");

      newAccessToken = generateAccessToken(
        mailbox.id,
        mailbox.emailAddress,
        "USER"
      );
    }

    res.cookie("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json(
      new ApiResponse(200, "Access token refreshed", {
        accessToken: newAccessToken,
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "7d",
      })
    );
  } catch (err) {
    return ApiError.send(res, 401, "Invalid or expired refresh token");
  }
});

// logout
const logout = asyncHandler(async (req, res) => {
  res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions);

  return res.status(200).json(new ApiResponse(200, "Logged out successfully"));
});

// update profile or mailbox
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const mailboxId = req.mailbox?.id;

  if (!userId && !mailboxId) {
    return ApiError.send(res, 401, "Not authenticated");
  }

  const { name, email, phone, password } = req.body;

  // At least one field required
  if (
    ![name, email, phone, password].some((f) => f && f.trim && f.trim() !== "")
  ) {
    return ApiError.send(
      res,
      400,
      "At least one field is required to update profile"
    );
  }

  let updatedResult;

  if (userId) {
    // User/Admin update
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (password) {
      const hashedPassword = await hashPassword(password);
      updateData.password = hashedPassword;
    }

    updatedResult = await Prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, "User profile updated successfully", {
        user: updatedResult,
      })
    );
  }

  if (mailboxId) {
    // Mailbox update: only name & emailAddress
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.emailAddress = email;

    updatedResult = await Prisma.mailbox.update({
      where: { id: mailboxId },
      data: updateData,
      select: {
        id: true,
        name: true,
        emailAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, "Mailbox updated successfully", {
        mailbox: updatedResult,
      })
    );
  }
});

// get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const mailboxId = req.mailbox?.id;

  if (!userId && !mailboxId)
    return ApiError.send(res, 401, "Not authenticated");

  if (userId && !mailboxId) {
    const user = await Prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) return ApiError.send(res, 404, "User not found");

    return res.status(200).json(new ApiResponse(200, "OK", { user: user }));
  }

  if (!userId && mailboxId) {
    const mailboxExits = await Prisma.mailbox.findUnique({
      where: { id: mailboxId },
    });

    if (!mailboxExits) return ApiError.send(res, 404, "mailbox user not found");
    const { password: _, ...mailboxSafe } = mailboxExits;

    const mailboxResponse = {
      ...mailboxSafe,
      role: "USER",
    };
    return res
      .status(200)
      .json(new ApiResponse(200, "OK", { user: mailboxResponse }));
  }
});

// change pass
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!req.user) return ApiError.send(res, 401, "Not authenticated");
  if (!currentPassword || !newPassword)
    return ApiError.send(res, 400, "Both passwords are required");

  // If user model
  if (req.user.model === "USER") {
    const user = await Prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });
    if (!user) return ApiError.send(res, 404, "User not found");

    const ok = await comparePassword(currentPassword, user.password);
    if (!ok) return ApiError.send(res, 401, "Current password is incorrect");

    const hashed = await hashPassword(newPassword);
    await Prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Password changed successfully"));
  } else {
    // mailbox change password
    const mailbox = await Prisma.mailbox.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });
    if (!mailbox) return ApiError.send(res, 404, "Mailbox not found");

    const ok = await comparePassword(currentPassword, mailbox.password);
    if (!ok) return ApiError.send(res, 401, "Current password is incorrect");

    const hashed = await hashPassword(newPassword);
    await Prisma.mailbox.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Password changed successfully"));
  }
});

// forgot pass
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return ApiError.send(res, 400, "Email is required");

  const user = await Prisma.user.findUnique({ where: { email } });
  if (!user) return ApiError.send(res, 404, "User not found");

  // Create a short lived token (e.g., 1 hour)
  const token = jwt.sign(
    { id: user.id, purpose: "password_reset" },
    process.env.RESET_TOKEN_SECRET,
    {
      expiresIn: "1h",
    }
  );

  // TODO: send email with link in real app
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  return res.status(200).json(
    new ApiResponse(200, "Password reset link generated (check logs)", {
      resetUrl,
    })
  );
});

// reset pass
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return ApiError.send(res, 400, "Token and new password are required");

  try {
    const decoded = jwt.verify(token, process.env.RESET_TOKEN_SECRET);
    if (decoded.purpose !== "password_reset")
      return ApiError.send(res, 400, "Invalid reset token");

    const user = await Prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return ApiError.send(res, 404, "User not found");

    const hashed = await hashPassword(newPassword);
    await Prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successfully"));
  } catch (err) {
    return ApiError.send(res, 400, "Invalid or expired token");
  }
});

// ====================== super admin (no query params) ==========================
export const allAdmins = asyncHandler(async (req, res) => {
  const superAdminId = req.user?.id;
  if (!superAdminId) return ApiError.send(res, 401, "Unauthorized user");
  if (req.user.role !== "SUPER_ADMIN") {
    return ApiError.send(
      res,
      403,
      "Forbidden: Only superadmin can access this"
    );
  }

  const admins = await Prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(
    new ApiResponse(200, "All admins fetched successfully", {
      data: admins,
    })
  );
});

export const toggleAdminStatus = asyncHandler(async (req, res) => {
  const superAdminId = req.user?.id;
  const { userId } = req.params;

  if (!superAdminId) {
    return ApiError.send(res, 401, "Unauthorized user");
  }

  if (req.user.role !== "SUPER_ADMIN") {
    return ApiError.send(
      res,
      403,
      "Forbidden: Only superadmin can access this"
    );
  }

  if (!userId) {
    return ApiError.send(res, 400, "'userId' is required");
  }

  if (userId === superAdminId) {
    return ApiError.send(res, 400, "You cannot update your own status");
  }

  const target = await Prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isAuthorized: true,
    },
  });

  if (!target) return ApiError.send(res, 404, "Admin not found");
  if (target.role === "SUPER_ADMIN")
    return ApiError.send(res, 403, "Cannot update another super admin");

  const updated = await Prisma.user.update({
    where: { id: userId },
    data: { isActive: !target.isActive },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        `Admin status toggled to ${updated.isActive ? "Active" : "Inactive"}`,
        updated
      )
    );
});

export const getAllData = asyncHandler(async (req, res) => {
  const superAdminId = req.user?.id;
  if (!superAdminId) return ApiError.send(res, 401, "Unauthorized user");

  if (req.user.role !== "SUPER_ADMIN") {
    return ApiError.send(
      res,
      403,
      "Forbidden: Only superadmin can access this"
    );
  }

  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 10;

  const [admins, totalAdmins] = await Promise.all([
    Prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        domains: {
          select: { id: true, name: true },
        },
        mailboxes: {
          select: { id: true, emailAddress: true },
        },
        subscriptions: {
          orderBy: { startDate: "desc" },
          take: 1, // last subscription only
        },
        _count: {
          select: {
            sentEmails: true,
            receivedEmails: true,
          },
        },
      },
    }),
    Prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  if (!admins || admins.length === 0)
    return ApiError.send(res, 404, "Admins not found");

  const formatted = admins.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
    totalDomains: admin.domains.length,
    domainNames: admin.domains.map((d) => d.name),
    totalMailboxes: admin.mailboxes.length,
    mailboxNames: admin.mailboxes.map((m) => m.emailAddress),
    totalSentEmails: admin._count.sentEmails,
    totalReceivedEmails: admin._count.receivedEmails,
    lastSubscription: admin.subscriptions[0] || null,
  }));

  return res.status(200).json(
    new ApiResponse(200, "Admins fetched successfully", {
      totalAdmins,
      page,
      limit,
      admins: formatted,
    })
  );
});

/// lending page
export const getAllUsers = asyncHandler(async (req, res) => {
  const totalUsers = await Prisma.user.count({
    where: { isActive: true },
  });

  return res.status(200).json(new ApiResponse(200, "All users", totalUsers));
});

export {
  signup,
  verifySignup,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfile,
};
