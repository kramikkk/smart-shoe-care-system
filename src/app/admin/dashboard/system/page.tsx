import NotificationCard from "@/components/SystemAlertCard"
import SensCard from "@/components/SensorCard"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation";

export default async function SystemPage() {
  const session = await auth.api.getSession({
      headers: await headers(), // you need to pass the headers object.
    });
    if (!session) {
      redirect("/admin/login");
    }
  return (
    <div className="space-y-4">
      <div>
        <SensCard id="systemStatus"/>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
        <SensCard id="temperature"/>
        <SensCard id="humidity"/>
        <SensCard id="atomizerLevel"/>
        <SensCard id="uvLamp"/>
      </div>

      <div>
        <NotificationCard />
      </div>
    </div>

  )
}