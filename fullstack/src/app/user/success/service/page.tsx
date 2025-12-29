"use client";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProcessSuccess() {
  const searchParams = useSearchParams();
  const service = searchParams.get('service');
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      router.push('/user');
    }
  }, [countdown, router]);

  const getMessage = () => {
    if (service === 'package') {
      return "Your shoes have been cleaned, dried, and sterilized to perfection!";
    }
    if (service === 'cleaning') {
      return "Your shoes are now clean and fresh!";
    }
    if (service === 'drying') {
      return "Your shoes are now completely dry!";
    }
    if (service === 'sterilizing') {
      return "Your shoes have been sterilized and sanitized!";
    }
    return "Service completed successfully!";
  };

  const getServiceName = () => {
    if (service === 'package') return 'Complete Package';
    if (service === 'cleaning') return 'Cleaning';
    if (service === 'drying') return 'Drying';
    if (service === 'sterilizing') return 'Sterilizing';
    if (service) return service.charAt(0).toUpperCase() + service.slice(1);
    return 'Service';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 py-6">
      <div className="bg-white/80 py-8 px-10 rounded-3xl shadow-2xl backdrop-blur-md w-[500px]">
        {/* Success Icon */}
        <div className="mb-4">
          <PartyPopper className="w-24 h-24 text-green-600 mx-auto" strokeWidth={2} />
        </div>

        {/* Thank You Message */}
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Thank You!
        </h1>
        <h2 className="text-2xl font-bold text-green-600 mb-4">Process Completed</h2>

        {/* Service Badge */}
        <div className="flex justify-center mb-4">
          <span className="inline-block px-5 py-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full text-base font-bold text-green-800 shadow-md">
            {getServiceName()} ✓
          </span>
        </div>

        {/* Success Message */}
        <p className="text-base text-gray-700 mb-6 leading-relaxed px-2">{getMessage()}</p>

        {/* Home Button */}
        <Link href="/user">
          <Button className="px-10 py-5 mb-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95">
            <p className='text-lg font-bold'>Return Home</p>
          </Button>
        </Link>

        {/* Auto Redirect Info */}
        <p className="text-gray-500 text-sm mt-3">
          Automatically redirecting in <span className="font-bold text-gray-700">{countdown}</span> seconds
        </p>
      </div>
    </div>
  );
}
