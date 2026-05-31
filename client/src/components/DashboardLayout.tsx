import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  SidebarFooter,
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
  ScrollText,
  Settings,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { SwirlingBackground } from "./SwirlingBackground";
import { FloatingHRIcons } from "./FloatingHRIcons";

// ─── Navigation Config ────────────────────────────────────────────────────────
const hiringManagerItems = [
  { icon: MessageSquarePlus, label: "New Hire Request", path: "/hire" },
  { icon: ListChecks, label: "My Requests", path: "/my-requests" },
  { icon: Briefcase, label: "My Job Postings", path: "/my-postings" },
];

const hrAdminItems = [
  { icon: BarChart3, label: "HR Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Job Templates", path: "/templates" },
  { icon: Globe, label: "Posting Sources", path: "/sources" },
  { icon: ScrollText, label: "Posting Logs", path: "/logs" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

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
  const allItems = [...hiringManagerItems, ...(isAdmin ? hrAdminItems : [])];
  const activeMenuItem = allItems.find(item => item.path === location);

  const roleBadgeLabel = isAdmin ? "HR Admin" : "Hiring Manager";
  const roleBadgeColor = isAdmin ? "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20" : "bg-emerald-50 text-emerald-700 border-emerald-200";

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
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-[#8B5CF6] flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-sidebar-foreground truncate leading-none">247 Labs</p>
                    <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">HR Platform</p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            {/* Hiring Manager Section */}
            <SidebarGroup>
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
                        className={`h-9 transition-all font-normal ${isActive ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#8B5CF6]" : ""}`} />
                        <span className="text-sm">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            {/* HR Admin Section */}
            {isAdmin && (
              <SidebarGroup className="mt-2">
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
                          className={`h-9 transition-all font-normal ${isActive ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#8B5CF6]" : ""}`} />
                          <span className="text-sm">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                    <AvatarFallback className="text-xs font-semibold bg-[#8B5CF6] text-white">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">{user?.name || "User"}</p>
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border mt-1 ${roleBadgeColor}`}>
                        {roleBadgeLabel}
                      </span>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
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
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-sm">{activeMenuItem?.label ?? "247 Labs HR"}</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 bg-[#F9FAFB] min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
