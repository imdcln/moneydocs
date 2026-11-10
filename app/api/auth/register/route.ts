import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.name || !body.email || !body.password) {
      return NextResponse.json(
        {
          error: "Name, email, and password are required.",
          code: "MISSING_FIELDS",
        },
        { status: 400 }
      );
    }

    const { name, email, password, baseCurrency } = body;

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        {
          error: "Password must be at least 6 characters long.",
          code: "PASSWORD_TOO_SHORT",
        },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanName = String(name).trim();

    try {
      await connectDB();
    } catch (dbError) {
      const dbErr = dbError as Error;
      console.error("[register API] MongoDB connection failure:", dbErr);
      return NextResponse.json(
        {
          error: "Database connection failed. Please verify your MongoDB configuration.",
          code: "DATABASE_CONNECTION_ERROR",
          details: dbErr?.message || String(dbError),
        },
        { status: 503 }
      );
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          code: "USER_ALREADY_EXISTS",
        },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      baseCurrency: baseCurrency || "IDR",
      hasCompletedOnboarding: false,
      authProvider: "credentials",
      isVerified: false,
    });

    return NextResponse.json(
      {
        message: "Account created successfully.",
        user: {
          id: String(newUser._id),
          name: newUser.name,
          email: newUser.email,
          authProvider: "credentials",
          isVerified: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as Error & { code?: number | string };
    console.error("[register error]:", err);

    // Handle Mongo duplicate key error (code 11000)
    if (err?.code === 11000) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          code: "USER_ALREADY_EXISTS",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: err?.message || "Failed to create account. Please try again.",
        code: (err?.code ? String(err.code) : undefined) || err?.name || "INTERNAL_SERVER_ERROR",
        details: process.env.NODE_ENV !== "production" ? (err?.stack || String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
