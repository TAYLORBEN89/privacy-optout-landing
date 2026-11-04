import { useEffect, useState } from "react";
import { authGateEnabled, fetchMe, startHref, startPageAction } from "./authGate";
import { Header } from "./Header";
import { SiteFooter } from "./Footer";
import { usePathname } from "./router";
import { SeoHead } from "./seoHead";
import { routePage } from "./routePage";

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

  const page = routePage(path, {
    getStartedHref: getStarted,
    action: pageAction,
    csrfToken: session.status === "in" ? session.me.csrf_token : null,
    me: session.status === "in" ? session.me : null,
  });

  return (
    <>
      <SeoHead path={path} />
      <div className="top-stack">
        <Header
          signedIn={signedIn}
          csrf={session.status === "in" ? session.me.csrf_token : null}
          path={path}
          onSignedOut={() => setSession({ status: "out", httpStatus: 401 })}
        />
      </div>
      <div className={showNav ? "shell" : "solo"}>
        <div className="content">{page}</div>
      </div>
      <SiteFooter />
    </>
  );
}
