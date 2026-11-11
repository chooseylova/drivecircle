import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Car, Map, ShoppingBag, User, Home, Trophy, MessageSquare, Bell, Radio, Gift, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useLiveShare } from "@/lib/LiveShareContext";

// Every section in the app
const ITEMS = {
  feed: { path: "/", icon: Home, label: "Feed" },
  events: { path: "/events", icon: Map, label: "Events" },
  live: { path: "/live", icon: Radio, label: "Live Map", short: "Live" },
  giveaways: { path: "/giveaways", icon: Gift, label: "Giveaways", short: "Win" },
  market: { path: "/marketplace", icon: ShoppingBag, label: "Market" },
  messages: { path: "/messages", icon: MessageSquare, label: "Messages", short: "Chat" },
  garage: { path: "/garage", icon: Car, label: "Garage" },
  top: { path: "/leaderboard", icon: Trophy, label: "Top Rides" },
  alerts: { path: "/notifications", icon: Bell, label: "Alerts" },
  profile: { path: "/profile", icon: User, label: "Profile" },
};

// Desktop: 6 in the bar + "More". Phone: 4 in the bottom bar + "More".
const DESKTOP_MAIN = ["feed", "events", "live", "giveaways", "market", "messages"];
const DESKTOP_MORE = ["garage", "top", "alerts", "profile"];
const MOBILE_MAIN = ["feed", "events", "live", "messages"];
const MOBILE_MORE = ["giveaways", "market", "garage", "top", "alerts", "profile"];

// Which nav item owns which sub-pages
const sectionOf = {
  "/car": "/garage", "/create-car": "/garage", "/edit-car": "/garage",
  "/event": "/events", "/create-event": "/events",
  "/post": "/", "/user": "/",
};

function MoreMenu({ keys, isActivePath, variant }) {
  const navigate = useNavigate();
  const anyActive = keys.some((k) => isActivePath(ITEMS[k].path));
  const trigger =
    variant === "mobile" ? (
      <button className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 rounded-xl outline-none ${anyActive ? "text-primary" : "text-muted-foreground"}`}>
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[9px] font-medium leading-tight">More</span>
      </button>
    ) : (
      <button
        title="More"
        className={`flex items-center gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-medium outline-none transition-all ${
          anyActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        <MoreHorizontal className="w-4 h-4" />
        <span className="hidden xl:inline">More</span>
      </button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={variant === "mobile" ? "top" : "bottom"} className="w-48 bg-card border-border z-[60]">
        {keys.map((k) => {
          const it = ITEMS[k];
          const active = isActivePath(it.path);
          return (
            <DropdownMenuItem key={k} onSelect={() => navigate(it.path)} className={`gap-2 py-2.5 cursor-pointer ${active ? "text-primary" : ""}`}>
              <it.icon className="w-4 h-4" /> {it.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LivePill() {
  const { sharing, stop } = useLiveShare();
  if (!sharing) return null;
  return (
    <div className="flex items-center gap-1 bg-primary/15 border border-primary/40 rounded-full pl-2.5 pr-1 py-0.5">
      <Link to="/live" className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-primary" title="You're sharing your location">
        <span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-primary" /></span>
        LIVE
      </Link>
      <button onClick={() => stop()} className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded-full" title="Stop sharing location">
        Stop
      </button>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const { pathname } = location;

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const isActivePath = (path) => {
    if (pathname === path) return true;
    const base = "/" + (pathname.split("/")[1] || "");
    return base !== "/" && sectionOf[base] === path;
  };

  return (
    <div className="min-h-screen bg-background font-inter flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src="https://media.base44.com/images/public/69f1686f8b1e1cd7389af35e/9c09cb6c8_Screenshot_20260429_110614_Gallery.jpg" alt="Drive Circle" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            <span className="font-orbitron font-bold text-lg tracking-wider text-foreground truncate">DRIVE CIRCLE</span>
          </Link>
          <div className="flex items-center gap-2">
            <LivePill />
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {DESKTOP_MAIN.map((k) => {
                const item = ITEMS[k];
                const isActive = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={`flex items-center gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>
                );
              })}
              <MoreMenu keys={DESKTOP_MORE} isActivePath={isActivePath} variant="desktop" />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch py-1.5">
          {MOBILE_MAIN.map((k) => {
            const item = ITEMS[k];
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_8px_hsl(120,60%,35%)]" : ""}`} />
                <span className="text-[9px] font-medium leading-tight truncate max-w-full px-0.5">{item.short || item.label}</span>
              </Link>
            );
          })}
          <MoreMenu keys={MOBILE_MORE} isActivePath={isActivePath} variant="mobile" />
        </div>
      </nav>
    </div>
  );
}
