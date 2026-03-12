import React from 'react'
import { Check } from 'lucide-react'

interface StepIndicatorProps {
  steps: readonly string[]
  currentStep: number // 0-based
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-3">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
              i < currentStep
                ? 'bg-gradient-to-br from-blue-600 to-green-600 text-white shadow-md'
                : i === currentStep
                  ? 'bg-gradient-to-br from-blue-500 via-cyan-500 to-green-500 text-white shadow-lg scale-110 ring-2 ring-white/60'
                  : 'bg-white/40 text-gray-400'
            }`}>
              {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${
              i === currentStep ? 'text-gray-800' : i < currentStep ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-10 h-0.5 mb-4 mx-1 rounded-full transition-all duration-200 ${
              i < currentStep ? 'bg-gradient-to-r from-blue-500 to-green-500' : 'bg-gray-300/60'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
