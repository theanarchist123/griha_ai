import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that should always stay public
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/api(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (process.env.NODE_ENV !== "production") return;

  const { userId, redirectToSignIn } = await auth();

  if (isPublicRoute(request)) return;

  if (!userId) {
    return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};