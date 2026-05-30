import { handlers } from "@/auth";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

function notFound() {
  return new Response("Not found", { status: 404 });
}

export const GET = isMainPageSsoEnabled() ? handlers.GET : notFound;
export const POST = isMainPageSsoEnabled() ? handlers.POST : notFound;
