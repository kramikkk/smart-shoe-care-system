'use client'

import { WifiOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function NoWifiPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-green-200 via-cyan-200 to-blue-400 p-4">
      <Card className="w-full max-w-2xl bg-white/90 border-gray-200 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative bg-red-500/10 p-8 rounded-full border-2 border-red-500/30 animate-pulse">
              <WifiOff className="h-24 w-24 text-red-400" />
            </div>
          </div>
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
            No WiFi Connection
          </CardTitle>
          <CardDescription className="text-xl text-gray-700 mt-2">
            Device is not connected to the network
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Alert className="bg-blue-50 border-blue-200 text-center">
            <AlertTitle className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent text-center">
              Please contact the administrator
            </AlertTitle>
            <AlertDescription className="text-gray-600 text-center justify-items-center">
              This device requires network configuration by an authorized administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
