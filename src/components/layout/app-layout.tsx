
"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { Briefcase, Clipboard, GraduationCap, LogOut, Settings, ClipboardCheck, Bot, Library, Users, BookOpenCheck, CalendarClock, CalendarCheck, CalendarCog } from "lucide-react"; 

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { usePathname } from "next/navigation";
import { ChatbotAssistant } from "@/components/chatbot/ChatbotAssistant";

interface AppLayoutProps {
  children: ReactNode;
  role: 'student' | 'admin' | 'teacher';
  user: { name: string; initials: string; avatarUrl?: string; id: string; };
  onLogout: () => void;
  pageTitle?: string;
  pageHeaderActions?: React.ReactNode;
}

const studentNavItems: NavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/student/profile", label: "Profile", icon: "User" },
  { href: "/student/attendance", label: "Attendance", icon: "BookCheck" },
  { href: "/student/marks", label: "Marks", icon: "BarChart3" },
  { href: "/student/exams", label: "Exams", icon: "CalendarCheck" },
  { href: "/student/fees", label: "Fees", icon: "CreditCard" },
  { href: "/student/hostel", label: "Hostel", icon: "Home" },
  { href: "/student/timetable", label: "Time Table", icon: "Calendar" },
  { href: "/student/materials", label: "Course Materials", icon: "BookOpen" },
  { href: "/student/performance", label: "Performance", icon: "TrendingUp" },
  { href: "/student/resume", label: "Resume Builder", icon: "FileText" },
  { href: "/student/invoices", label: "Invoices", icon: "Receipt" },
  { href: "/student/internships", label: "Internships", icon: "Clipboard" },
  { href: "/student/placements", label: "Placements", icon: "Briefcase" },
  { href: "/chat", label: "Chat", icon: "MessageSquare" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

const adminNavItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/admin/students", label: "Students", icon: "Users" },
  { href: "/admin/teachers", label: "Staff", icon: "UserCog" },
  { href: "/admin/classes", label: "Classes", icon: "Library" },
  { href: "/admin/courses", label: "Courses", icon: "BookOpenCheck" },
  { href: "/admin/timetables", label: "Timetables", icon: "CalendarClock" },
  { href: "/admin/hostels", label: "Hostels", icon: "Home" },
  { href: "/admin/opportunities", label: "Opportunities", icon: "Briefcase" },
  { href: "/admin/attendance", label: "Overall Attendance", icon: "ClipboardCheck" },
  { href: "/admin/marks", label: "Overall Marks", icon: "Edit" },
  { href: "/admin/exams", label: "Exam Schedules", icon: "CalendarCog" },
  { href: "/admin/fees", label: "Fees Management", icon: "Banknote" },
  { href: "/admin/chat", label: "Chat Management", icon: "MessageSquarePlus" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

const teacherNavItems: NavItem[] = [
   { href: "/teacher/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
   { href: "/teacher/profile", label: "My Profile", icon: "User" },
   { href: "/teacher/students", label: "My Students", icon: "Users" },
   { href: "/teacher/materials", label: "Course Materials", icon: "BookOpen" },
   { href: "/teacher/marks", label: "Manage Marks", icon: "Edit" },
   { href: "/teacher/attendance", label: "Class Attendance", icon: "CalendarCheck" },
   { href: "/chat", label: "Chat", icon: "MessageSquare" },
   { href: "/settings", label: "Settings", icon: "Settings" },
];


export function AppLayout({ children, role, user, onLogout, pageHeaderActions: pageHeaderActionsProp, pageTitle: pageTitleProp }: AppLayoutProps) {
  const pathname = usePathname();

  let navItems: NavItem[];
  switch (role) {
    case 'admin':
      navItems = adminNavItems;
      break;
    case 'teacher':
      navItems = teacherNavItems;
      break;
    case 'student':
    default:
      navItems = studentNavItems;
      break;
  }
  
  const pageTitle = pageTitleProp || navItems.find(item => pathname.startsWith(item.href) && item.href !== '/chat')?.label;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <Button variant="ghost" size="icon" className="text-primary hover:bg-transparent">
                <GraduationCap size={24}/>
              </Button>
              <span className="font-semibold text-lg text-primary">EduSphere Connect</span>
            </div>
          <SidebarTrigger className="md:hidden"/>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarNav items={navItems} />
        </SidebarContent>
        <Separator className="my-1 group-data-[collapsible=icon]:hidden" />
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
             <div className="flex items-center gap-2">
                 <Avatar
                    className={cn("h-8 w-8 sidebar-avatar")}
                    data-role={role}
                  >
                 <AvatarImage src={user?.avatarUrl} alt={user?.name || ''} />
                 <AvatarFallback>{user?.initials || '?'}</AvatarFallback>
                 </Avatar>
                 <span className="text-sm font-medium">{user?.name || 'User'}</span>
             </div>
             <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Logout">
                <LogOut className="h-4 w-4" />
             </Button>
          </div>
           <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Logout" className="hidden group-data-[collapsible=icon]:flex">
             <LogOut className="h-5 w-5" />
           </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
         <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 p-2 backdrop-blur-sm print:hidden">
           {/* Mobile Header */}
           <div className="flex items-center gap-2 md:hidden">
              <Button variant="ghost" size="icon" className="text-primary">
                 <GraduationCap size={24}/>
              </Button>
              <span className="font-semibold text-lg text-primary truncate max-w-[120px] sm:max-w-none">
                {pageTitle || "EduSphere Connect"}
              </span>
            </div>
            {pageHeaderActionsProp && <div className="flex items-center gap-2 md:hidden ml-auto mr-1">{pageHeaderActionsProp}</div>}
            <div className="flex items-center gap-1 sm:gap-2 md:hidden">
                <NotificationBell />
                <ThemeToggle />
                <SidebarTrigger />
            </div>

            {/* Desktop Header */}
            <div className="hidden md:flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                {pageTitle ? (
                  <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
                ) : (
                  <div className="flex items-center gap-2">
                     <Button variant="ghost" size="icon" className="text-primary hover:bg-transparent" disabled>
                       <GraduationCap size={24}/>
                     </Button>
                     <span className="font-semibold text-lg text-primary">EduSphere Connect</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {pageHeaderActionsProp && <div className="mr-2">{pageHeaderActionsProp}</div>}
                <NotificationBell />
                <ThemeToggle />
              </div>
            </div>
         </header>
         <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
          {children}
         </main>
         <ChatbotAssistant user={{...user, role}}/>
      </SidebarInset>
    </SidebarProvider>
  );
}
