import type { ReactElement } from "react";
import { type MeOk, type StartAction } from "./authGate";
import {
  ChildrenBenefitPage,
  ControlBenefitPage,
  CostBenefitPage,
  RightsBenefitPage,
  SecurityBenefitPage,
  SpamBenefitPage,
  TimeBenefitPage,
} from "./pages/benefits";
import { AboutPage } from "./pages/AboutPage";
import { AccountPage } from "./pages/AccountPage";
import { BrokersPage } from "./pages/BrokersPage";
import { HomePage } from "./pages/HomePage";
import {
  ChildrenPage,
  DataBrokersPage,
  HelpPage,
  HowItWorksPage,
  OverviewPage,
  PersonalInformationPage,
  SharePage,
  TdpsaPage,
  UniqueIdentifiersPage,
} from "./pages/topics";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SecurityPage } from "./pages/SecurityPage";
import { SignInPage } from "./pages/SignInPage";
import { StartPage } from "./pages/StartPage";

export function routePage(
  path: string,
  ctx: {
    getStartedHref: string;
    action: StartAction;
    csrfToken: string | null;
    me: MeOk | null;
  },
): ReactElement {
  if (path === "/security") return <SecurityPage />;
  if (path === "/privacy") return <PrivacyPage />;
  if (path === "/brokers") return <BrokersPage />;
  if (path === "/overview") return <OverviewPage />;
  if (path === "/how-it-works") return <HowItWorksPage />;
  if (path === "/personal-information") return <PersonalInformationPage />;
  if (path === "/data-brokers") return <DataBrokersPage />;
  if (path === "/unique-identifiers") return <UniqueIdentifiersPage />;
  if (path === "/tdpsa") return <TdpsaPage />;
  if (path === "/children") return <ChildrenPage />;
  if (path === "/benefits/control") return <ControlBenefitPage />;
  if (path === "/benefits/spam") return <SpamBenefitPage />;
  if (path === "/benefits/security") return <SecurityBenefitPage />;
  if (path === "/benefits/time") return <TimeBenefitPage />;
  if (path === "/benefits/cost") return <CostBenefitPage />;
  if (path === "/benefits/rights") return <RightsBenefitPage />;
  if (path === "/benefits/children") return <ChildrenBenefitPage />;
  if (path === "/help") return <HelpPage />;
  if (path === "/share") return <SharePage />;
  if (path === "/about") return <AboutPage />;
  if (path === "/signin") return <SignInPage />;
  if (path === "/start") return <StartPage action={ctx.action} csrfToken={ctx.csrfToken} />;
  if (path === "/account") return <AccountPage action={ctx.action} me={ctx.me} />;
  return <HomePage getStartedHref={ctx.getStartedHref} />;
}
