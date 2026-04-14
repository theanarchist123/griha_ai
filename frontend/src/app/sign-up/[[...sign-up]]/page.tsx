"use client";

import { SignUp, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Page() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/onboarding");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return <div className="min-h-screen bg-cream" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
      />
    </div>
  );
}