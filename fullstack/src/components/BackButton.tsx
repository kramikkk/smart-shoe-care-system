'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function BackButton() {
  const router = useRouter()

  return (
    <Button
      onClick={() => router.back()}
      className="fixed top-8 left-8 z-50 gap-3 px-8 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
    >
      <ArrowLeft className="w-7 h-7" />
      <span className="text-xl font-bold">Back</span>
    </Button>
  )
}
