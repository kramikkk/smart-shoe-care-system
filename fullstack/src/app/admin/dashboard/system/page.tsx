import SensCard from "@/components/SensorCard"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation";
import SystemAlertCard from "@/components/SystemAlertCard";

export default async function SystemPage() {
  const session = await auth.api.getSession({
      headers: await headers(), // you need to pass the headers object.
    });
    if (!session) {
      redirect("/admin/login");
    }
  return (
    <div className="flex flex-col space-y-4 h-full">
      <div>
        <SensCard id="systemStatus"/>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
        <SensCard id="temperature"/>
        <SensCard id="foamLevel"/>
        <SensCard id="atomizerLevel"/>
        <SensCard id="uvLamp"/>
      </div>

      <div className="flex-1 min-h-0">
        <SystemAlertCard /> 
      </div>
    </div>

  )
}