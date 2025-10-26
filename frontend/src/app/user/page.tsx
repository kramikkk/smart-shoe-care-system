import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

const user = () => {
  return (
    <div className=''>
      <Image
        src="/SSCMlogoTrans.png"
        alt="User Illustration"
        width={300}
        height={300}
        className="mx-auto mb-8"
      />
      <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Smart Shoe Care Machine
      </h1>
      <p className="text-center text-2xl text-gray-700">
        Keep your shoes fresh, clean, and ready to wear.
      </p>
      <div className="flex justify-center">
        <Link href="/user/mode">
          <Button className="mt-8 px-12 py-8 text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-md">
            Start
          </Button>
        </Link>
      </div>
      <p className="text-center text-gray-500 mt-4">
        Press the start button to begin.
      </p>
    </div>
  )
}

export default user