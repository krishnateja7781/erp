
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import * as Icons from "lucide-react"; // Import all icons

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

// Define the icon map type
type IconMap = {
  [key: string]: LucideIcon;
};

// Create the icon map
const iconMap: IconMap = {
  LayoutDashboard: Icons.LayoutDashboard,
  User: Icons.User,
  BookCheck: Icons.BookCheck,
  BarChart3: Icons.BarChart3,
  Users: Icons.Users,
  ClipboardCheck: Icons.ClipboardCheck,
  Edit: Icons.Edit,
  CreditCard: Icons.CreditCard,
  Home: Icons.Home,
  LogOut: Icons.LogOut,
  UserCog: Icons.UserCog,
  CalendarCheck: Icons.CalendarCheck,
  CalendarClock: Icons.CalendarClock,
  CalendarCog: Icons.CalendarCog,
  Ticket: Icons.Ticket,
  Banknote: Icons.Banknote,
  MessageSquare: Icons.MessageSquare,
  MessageSquarePlus: Icons.MessageSquarePlus,
  BookOpen: Icons.BookOpen,
  BookOpenCheck: Icons.BookOpenCheck,
  Calendar: Icons.Calendar,
  TrendingUp: Icons.TrendingUp,
  FileText: Icons.FileText,
  Receipt: Icons.Receipt,
  Clipboard: Icons.Clipboard,
  Briefcase: Icons.Briefcase,
  Settings: Icons.Settings,
  Bot: Icons.Bot,
  Library: Icons.Library,
  // Add any other icons used in navItems here
};


export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof iconMap; // Use string key for icon name
  tooltip?: string;
}

interface SidebarNavProps {
  items: NavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        // Look up the icon component from the map
        const IconComponent = iconMap[item.icon] || Icons.HelpCircle; // Default icon if not found
        // More robust active check: handles base paths and deeper paths.
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.tooltip || item.label}
            >
              <Link href={item.href}>
                <IconComponent /> {/* Render the dynamic icon component */}
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
