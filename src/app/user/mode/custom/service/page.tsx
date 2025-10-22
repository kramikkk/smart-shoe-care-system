import { Button } from '@/components/ui/button'
import { Droplets, Wind, ShieldCheck } from 'lucide-react'
import { Item, ItemContent } from '@/components/ui/item'
import Link from 'next/link'
import React from 'react'

const service = () => {
  return (
    <div>
      <h1 className="text-5xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Choose Service
      </h1>
      <div className='flex gap-8 justify-center'>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w flex flex-col items-center'>
          <Droplets className="w-16 h-16 text-blue-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Cleaning</h2>
            <p className="text-xl text-gray-600">Surface clean your shoes</p>
            <Link href="/user/payment">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Cleaning</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w flex flex-col items-center'>
          <Wind className="w-16 h-16 text-cyan-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Drying</h2>
            <p className="text-xl text-gray-600">Quick dry your shoes</p>
            <Link href="/user/payment">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Drying</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w flex flex-col items-center'>
          <ShieldCheck className="w-16 h-16 text-green-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Sterilizing</h2>
            <p className="text-xl text-gray-600">Sanitize your shoes</p>
            <Link href="/user/payment">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Sterilizing</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
      </div>
    </div>
  )
}

export default service