import { auth } from "@/auth";
import { ReportingPage } from "@/components/ReportingPage";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

export default async function HomePage() {
  const session = isMainPageSsoEnabled() ? await auth() : null;
  const showSignOut = isMainPageSsoEnabled() && Boolean(session);

  return <ReportingPage showSignOut={showSignOut} />;
}
