import { auth } from "@/auth";
import { ReportingPage } from "@/components/ReportingPage";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

export default async function HomePage() {
  const session = await auth();
  const showSignOut = isMainPageSsoEnabled() && Boolean(session);

  return <ReportingPage showSignOut={showSignOut} />;
}
