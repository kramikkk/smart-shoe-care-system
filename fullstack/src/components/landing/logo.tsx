import React from 'react'
import Image from 'next/image'

export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/SSCMLogoCircle.png"
        alt="SSCM Logo"
        width={32}
        height={32}
        className="object-contain"
        loading="eager"
      />
      <span className="font-semibold text-base">SSCM</span>
    </div>
  )
}
