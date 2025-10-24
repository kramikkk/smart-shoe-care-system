import { Button } from '@/components/ui/button'
import { Zap, Settings } from 'lucide-react'
import { Item, ItemContent } from '@/components/ui/item'
import Link from 'next/link'
import React from 'react'

const mode = () => {
  return (
    <div>
      <h1 className="text-5xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Select Mode
      </h1>
      <div className='flex gap-8 justify-center'>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w-100 flex flex-col items-center'>
        <Zap className="w-16 h-16 text-blue-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Auto Mode</h2>
            <p className="text-xl text-gray-600">Automatic Shoe Type Detection</p>
            <p className="text-xl text-gray-600">Automated Full Process</p>
            <Link href="/user/payment?service=package">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Auto Mode</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w-100 flex flex-col items-center'>
        <Settings className="w-16 h-16 text-cyan-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Custom Mode</h2>
            <p className="text-xl text-gray-600">Manual Shoe Type Selection</p>
            <p className="text-xl text-gray-600">Choose Between 3 Process</p>
            <Link href="/user/mode/custom">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Custom Mode</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
      </div>
    </div>
  )
}

export default mode