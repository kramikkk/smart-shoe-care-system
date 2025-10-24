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
  const [countdown, setCountdown] = useState(3);

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
      return "Automatic cleaning, drying, and sterilizing completed successfully!";
    }
    if (service === 'cleaning') {
      return "Cleaning completed successfully!";
    }
    if (service === 'drying') {
      return "Drying completed successfully!";
    }
    if (service === 'sterilizing') {
      return "Sterilization completed successfully!";
    }
    return "Process completed successfully!";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <div className="bg-white/50 py-10 px-30 rounded-2xl shadow-xl backdrop-blur-sm">
        <PartyPopper className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-green-600">Process Completed</h1>
        <p className="mt-3 text-lg">{getMessage()}</p>
        <p className="mt-2 text-gray-600">Redirecting to home in {countdown} seconds...</p>
        <Link href="/user" className="text-blue-600 mt-2 underline">
            <Button className="px-12 py-6 mt-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-green-600 hover:from-blue-700 hover:via-cyan-700 hover:to-green-700 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 active:shadow-sm">
                <p className='text-lg font-bold'>Home</p>
            </Button>
        </Link>
      </div>
    </div>
  );
}
