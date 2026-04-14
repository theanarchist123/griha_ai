"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
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
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
      />
    </div>
  );
}