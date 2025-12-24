import TransactionPage from './transactions-client'
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation";


export default async function page() {
  const session = await auth.api.getSession({
        headers: await headers(), // you need to pass the headers object.
      });
      if (!session) {
        redirect("/admin/login");
      }

  return <TransactionPage />;
}
