import { useEffect, useState } from "react";
import { authGateEnabled, fetchMe, SIGN_IN_HREF, startHref, startPageAction } from "./authGate";
import { Wordmark } from "./Brand";
import { DISCLAIMER } from "./copy";
import { Header } from "./Header";
import { AboutPage } from "./pages/AboutPage";
import { AccountPage } from "./pages/AccountPage";
import { BrokersPage } from "./pages/BrokersPage";
import { HomePage } from "./pages/HomePage";
import {
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
import { AppLink, usePathname } from "./router";

type Session =
  | { status: "off" }
  | { status: "loading" }
  | { status: "in"; me: import("./authGate").MeOk }
  | { status: "out"; httpStatus: number };

function normalize(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function App() {
  const path = normalize(usePathname());
  const gate = authGateEnabled();
  const [session, setSession] = useState<Session>(gate ? { status: "loading" } : { status: "off" });

  useEffect(() => {
    if (!gate) return;
    let live = true;
    fetchMe()
      .then((result) => {
        if (!live) return;
        if (result.ok) setSession({ status: "in", me: result });
        else setSession({ status: "out", httpStatus: result.status });
      })
      .catch(() => {
        if (live) setSession({ status: "out", httpStatus: 0 });
      });
    return () => {
      live = false;
    };
  }, [gate]);

  const signedIn = session.status === "in";
  const meStatus = session.status === "in" ? 200 : session.status === "out" ? session.httpStatus : "loading";
  const getStarted = startHref(gate, signedIn);
  const showNav = path !== "/signin";
  const pageAction = startPageAction(gate, session.status === "off" ? 200 : meStatus);

  let page = <HomePage getStartedHref={getStarted} />;
  if (path === "/security") page = <SecurityPage />;
  else if (path === "/privacy") page = <PrivacyPage />;
  else if (path === "/brokers") page = <BrokersPage />;
  else if (path === "/overview") page = <OverviewPage />;
  else if (path === "/how-it-works") page = <HowItWorksPage />;
  else if (path === "/personal-information") page = <PersonalInformationPage />;
  else if (path === "/data-brokers") page = <DataBrokersPage />;
  else if (path === "/unique-identifiers") page = <UniqueIdentifiersPage />;
  else if (path === "/tdpsa") page = <TdpsaPage />;
  else if (path === "/help") page = <HelpPage />;
  else if (path === "/share") page = <SharePage />;
  else if (path === "/about") page = <AboutPage />;
  else if (path === "/signin") page = <SignInPage />;
  else if (path === "/start") page = <StartPage action={pageAction} />;
  else if (path === "/account") {
    page = (
      <AccountPage
        action={pageAction}
        me={session.status === "in" ? session.me : null}
      />
    );
  }

  return (
    <>
      <div className="top-stack">
        <Header
          signedIn={signedIn}
          csrf={session.status === "in" ? session.me.csrf_token : null}
          signInHref={SIGN_IN_HREF}
          onSignedOut={() => setSession({ status: "out", httpStatus: 401 })}
        />
      </div>
      <div className={showNav ? "shell" : "solo"}>
        <div className="content">{page}</div>
      </div>
      <footer className="site-footer">
        <div className="footer-inner">
          <Wordmark />
          <p className="footer-links">
            <AppLink href="/privacy">Privacy & Security</AppLink>
          </p>
          <p className="independence">{DISCLAIMER}</p>
          <AppLink className="cta" href={getStarted}>
            Start Removing Me
          </AppLink>
        </div>
      </footer>
    </>
  );
}
