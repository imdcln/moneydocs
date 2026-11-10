import TransactionPage from "@/components/transactions/TransactionPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive Transactions | Onboarding Spotlight Guide",
  description: "Next.js Interactive Transaction page with step-by-step onboarding spotlight tour and celebration effects.",
};

export default function TransactionsGuidePage() {
  return <TransactionPage />;
}
