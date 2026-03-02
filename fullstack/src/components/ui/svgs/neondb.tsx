import type { SVGProps } from 'react'
export const NeonDB = (props: SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        {...props}>
        <path
            fill="currentColor"
            d="M4 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3v-5.5L17 20h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-3v5.5L7 4H4zm3 0h3.5L7 5.5V3zm6.5 16H10l3.5-2.5V19z"
        />
    </svg>
)
