import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Briefcase,
  FileText,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquarePlus,
  PanelLeft,
  Search,
  ScrollText,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SwirlingBackground } from "./SwirlingBackground";
import { FloatingHRIcons } from "./FloatingHRIcons";

// ─── Navigation Config ────────────────────────────────────────────────────────
const hiringManagerItems = [
  { icon: FileText, label: "Job Templates", path: "/templates" },
  { icon: Briefcase, label: "My Job Postings", path: "/my-postings" },
  { icon: MessageSquarePlus, label: "New Hire Request", path: "/hire" },
  { icon: ListChecks, label: "My Requests", path: "/my-requests" },
];

const hrAdminItems = [
  { icon: BarChart3, label: "HR Dashboard", path: "/dashboard" },
];

const distributionItems = [
  { icon: Globe, label: "Posting Sources", path: "/sources" },
  { icon: ScrollText, label: "Posting Logs", path: "/logs" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width-v2";
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 260;
const MAX_WIDTH = 480;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex min-h-screen bg-white">
        {/* Left Side: Brand/Visual (Hidden on mobile) */}
        <div className="relative hidden lg:flex flex-col justify-between w-1/2 bg-[#0F0A1A] overflow-hidden p-12">
          {/* Subtle Swirl specifically for the dark side */}
          <div className="absolute inset-0 z-0 opacity-50">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#78137C] rounded-full mix-blend-screen filter blur-[120px] animate-pulse" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/40 rounded-full mix-blend-screen filter blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
          
          <FloatingHRIcons />
          
          <div className="relative z-10 flex items-center gap-3">
            <img 
              src="https://247labs.com/wp-content/uploads/2023/03/Group-10.png" 
              alt="247 Labs Logo" 
              className="h-10 object-contain brightness-0 invert"
            />
          </div>

          <div className="relative z-10">
            <h2 className="text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
              Streamline your<br />recruiting workflow.
            </h2>
            <p className="text-lg text-white/70 max-w-md font-medium">
              Manage requests, track postings, and automate your hiring pipeline with our AI-powered HR platform.
            </p>
          </div>
          
          <div className="relative z-10">
            <p className="text-sm text-white/40 font-medium">© 2026 247 Labs. All rights reserved.</p>
          </div>
        </div>

        {/* Right Side: Action Area */}
        <div className="relative flex items-center justify-center w-full lg:w-1/2 p-8 lg:p-12">
          {/* Subtle background for right side on mobile */}
          <div className="absolute inset-0 z-0 lg:hidden opacity-30">
             <SwirlingBackground />
          </div>

          <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            {/* Logo visible only on mobile */}
            <div className="flex lg:hidden justify-center mb-10">
              <img 
                src="https://247labs.com/wp-content/uploads/2023/03/Group-10.png" 
                alt="247 Labs Logo" 
                className="h-12 object-contain"
              />
            </div>

            <div className="bg-white lg:bg-transparent shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:shadow-none border border-gray-100 lg:border-none rounded-3xl p-8 lg:p-0 w-full flex flex-col items-center text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">
                Welcome back
              </h1>
              <p className="text-base font-medium text-gray-500 max-w-sm mb-10">
                Sign in to access your HR workspace and manage recruiting workflows.
              </p>
              
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5 bg-primary hover:bg-primary/90 text-white"
              >
                Sign in to continue
                <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "hr_admin" || user?.role === "admin";
  const allItems = [
    ...hiringManagerItems,
    ...(isAdmin ? hrAdminItems : []),
    ...(isAdmin ? distributionItems : []),
  ];
  const activeMenuItem = allItems.find(item => item.path === location);

  const roleBadgeLabel = isAdmin ? "HR Admin" : "Hiring Manager";
  const currentPageTitle = activeMenuItem?.label ?? "247 Labs HR";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 overflow-hidden" disableTransition={isResizing}>
          {/* Subtle Swirl specifically for the dark sidebar */}
          <div className="absolute inset-0 z-0 opacity-40 pointer-events-none group-data-[collapsible=icon]:opacity-0 transition-opacity duration-300">
            <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-[#78137C] rounded-full mix-blend-screen filter blur-[80px] animate-pulse" />
            <div className="absolute bottom-0 right-[-100px] w-[400px] h-[400px] bg-blue-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          <SidebarHeader className="relative z-10 h-20 justify-center border-b border-sidebar-border/50 bg-transparent">
            <div className="flex items-center gap-4 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-10 w-10 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-5 w-5 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex flex-col items-start min-w-0">
                  <img 
                    src="https://247labs.com/wp-content/uploads/2023/03/Group-10.png" 
                    alt="247 Labs Logo" 
                    className="h-8 w-auto object-contain brightness-0 invert mb-0.5"
                  />
                  <p className="text-[10px] font-semibold tracking-[0.15em] text-white/50 uppercase ml-[8px]">
                    HR Platform
                  </p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="relative z-10 gap-0 py-2 bg-transparent">
            {/* HR Admin Section */}
            {isAdmin && (
              <SidebarGroup>
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1">
                    Administration
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="px-2">
                  {hrAdminItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-11 transition-all font-medium ${isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}`}
                        >
                          <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className="text-base">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            )}

            {/* Hiring Manager Section */}
            <SidebarGroup className={isAdmin ? "mt-2" : ""}>
              {!isCollapsed && (
                <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1">
                  Hiring
                </SidebarGroupLabel>
              )}
              <SidebarMenu className="px-2">
                {hiringManagerItems.map(item => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className={`h-11 transition-all font-medium ${isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}`}
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                        <span className="text-base">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup className="mt-2">
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1">
                    Distribution
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="px-2">
                  {distributionItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-11 transition-all font-medium ${isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}`}
                        >
                          <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className="text-base">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {isMobile && <SidebarTrigger className="h-10 w-10 rounded-lg border border-slate-200 bg-white" />}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
                <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-slate-950">{currentPageTitle}</h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative min-w-0 sm:w-[280px] lg:w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search jobs, templates, sources..."
                  className="h-11 rounded-lg border-slate-200 bg-slate-50 pl-10 pr-4 text-sm shadow-none placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white px-2 pr-4 text-left shadow-sm transition-colors hover:bg-slate-50 focus:outline-none">
                    <Avatar className="h-8 w-8 border border-slate-200">
                      <AvatarFallback className="bg-slate-950 text-xs font-semibold text-white">
                        {user?.name?.charAt(0).toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{user?.name || "User"}</p>
                      <p className="truncate text-xs text-slate-500">{roleBadgeLabel}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <main className="flex-1 min-h-screen bg-[#F9FAFB] p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
