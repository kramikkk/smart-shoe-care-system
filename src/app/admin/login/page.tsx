import { LoginForm } from "@/components/LoginForm"
import { ModeToggle } from "@/components/ModeToggle"

const LoginPage = () => {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="absolute top-4 right-4 sm:bottom-4 sm:right-4">
  <ModeToggle />
</div>
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  )
}

export default LoginPage
