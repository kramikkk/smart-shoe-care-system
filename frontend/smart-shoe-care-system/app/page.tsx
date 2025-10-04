import Image from "next/image"
import { LoginForm } from "@/components/LoginForm"

const LoginPage = () => {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-1">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image
              src="/globe.svg"
              alt="Smart Shoe Care Logo"
              width={30}
              height={30}
              className="rounded-md"
            />
            <h1 className="text-xl font-bold">Smart Shoe Care Machine</h1>
          </a>
          <p className="text-sm text-muted-foreground">
            An IoT automated cleaning, drying, and sterilizing machine
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}

export default LoginPage
