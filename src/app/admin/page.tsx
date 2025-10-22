import { redirect } from "next/navigation";

export default function AdminHome() {
  // If using authentication
  const isLoggedIn = false; // Replace with your auth check

  if (!isLoggedIn) {
    redirect("/admin/login");
  } else {
    redirect("/admin/dashboard");
  }

  return null;
}
