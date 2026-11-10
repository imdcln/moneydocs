import { redirect } from "next/navigation";

export default function AdminHelpRedirect() {
  redirect("/account/help");
}
