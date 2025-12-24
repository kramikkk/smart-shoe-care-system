import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function AdminHome() {
  const session = await auth.api.getSession({
    headers: await headers(), // you need to pass the headers object.
  });
  
  if (!session) {
    redirect("/admin/login");
  } else {
    redirect("/admin/dashboard");
  }
}
