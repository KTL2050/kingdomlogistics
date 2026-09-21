import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Sign in — Kingdom Trading Logistics",
  description: "Sign in to the Shipment Control Tower",
};

export default function LoginPage() {
  return <AuthCard />;
}