"use client";
import { CheckCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentSuccess() {
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
      // Redirect based on service
      if (service === 'package') {
        router.push('/user/mode/auto');
      } else if (service) {
        router.push(`/user/mode/custom/progress?service=${service}`);
      } else {
        router.push('/user');
      }
    }
  }, [countdown, service, router]);

  const getMessage = () => {
    if (service === 'package') {
      return "Full automatic cleaning process will begin shortly.";
    }
    if (service === 'cleaning') {
      return "Cleaning process will begin shortly.";
    }
    if (service === 'drying') {
      return "Drying process will begin shortly.";
    }
    if (service === 'sterilizing') {
      return "Sterilization process will begin shortly.";
    }
    return "Process will begin shortly.";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <div className="bg-white/50 py-10 px-30 rounded-2xl shadow-xl backdrop-blur-sm">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-green-600">Payment Successful</h1>
        <p className="mt-3 text-lg">{getMessage()}</p>
        <p className="text-gray-600 mt-2">Starting in {countdown} seconds...</p>
      </div>
    </div>
  );
}