import { Button } from '@/components/ui/button'
import { Droplets, Wind, ShieldCheck } from 'lucide-react'
import { Item, ItemContent } from '@/components/ui/item'
import Link from 'next/link'
import Image from 'next/image'
import { BackButton } from '@/components/BackButton'

const custom = () => {
  return (
    <div className="relative">
      <BackButton />

      <h1 className="text-5xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 bg-clip-text text-transparent">
        Choose Shoe Type
      </h1>
      <div className='flex gap-8 justify-center'>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w flex flex-col items-center'>
          <Image src="/MeshShoes.png" alt="Mesh" width={64} height={64} className="w-32 h-32 text-blue-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Mesh</h2>
            <p className="text-xl text-gray-600">Mesh-like material</p>
            <Link href="/user/mode/custom/service?shoe=mesh">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Mesh</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w flex flex-col items-center'>
          <Image src="/CanvasShoes.png" alt="Canvas" width={64} height={64} className="w-32 h-32 text-green-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Canvas</h2>
            <p className="text-xl text-gray-600">Fabric-like material</p>
            <Link href="/user/mode/custom/service?shoe=canvas">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Canvas</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
        <Item className='text-center bg-white/50 p-8 rounded-lg shadow-lg w flex flex-col items-center'>
          <Image src="/RubberShoes.png" alt="Rubber" width={64} height={64} className="w-32 h-32 text-green-600" />
          <ItemContent>
            <h2 className="text-2xl font-bold mb-4">Rubber</h2>
            <p className="text-xl text-gray-600">Rubber-like material</p>
            <Link href="/user/mode/custom/service?shoe=rubber">
              <Button className="mt-4 px-6 py-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Select Rubber</p>
              </Button>
            </Link>
          </ItemContent>
        </Item>
      </div>
    </div>
  )
}

export default custom