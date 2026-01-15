"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button'
import { MotionButton } from '@/components/ui/motion-button';
import {
  Home,
  Receipt,
  CreditCard,
  Menu,
  BarChart3,
  Tag,
  Settings,
  LogOut,
  Plus
} from 'lucide-react';
import { usePinAuth } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

// Mobile navigation items (5 total)
const mobileNavItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    mobileLabel: 'Home',
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: CreditCard,
    mobileLabel: 'Spend',
  },
  // Central ADD button will be separate
  {
    name: 'Paychecks',
    href: '/paychecks',
    icon: Receipt,
    mobileLabel: 'Paychecks',
  },
  {
    name: 'More',
    href: '#',
    icon: Menu,
    mobileLabel: 'More',
  },
];

// Menu navigation items (in drawer)
const menuNavItems = [
  {
    name: 'Categories',
    href: '/categories',
    icon: Tag,
    description: 'Manage budget categories',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Profile and preferences',
  },
];

// All navigation items (for desktop sidebar)
// All navigation items (for desktop sidebar)
const allNavItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: CreditCard,
  },
  {
    name: 'Paychecks',
    href: '/paychecks',
    icon: Receipt,
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: Tag,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { signOut } = usePinAuth();
  const router = useRouter();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow bg-card border-r pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold text-primary">BudgetBud</h1>
          </div>
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {allNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
            </nav>
            <div className="px-2 mt-4">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t z-50">
        <div className="grid grid-cols-5 h-16 relative">
          {/* Left navigation items */}
          {mobileNavItems.slice(0, 2).map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center min-h-[44px] active:bg-accent/50 transition-colors"
              >
                <item.icon
                  className={`h-5 w-5 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className={`text-xs mt-1 ${
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}>
                  {item.mobileLabel || item.name}
                </span>
              </Link>
            );
          })}

          {/* Central ADD Button */}
          <Drawer open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
            <DrawerTrigger asChild>
              <button className="flex flex-col items-center justify-center min-h-[44px] relative">
                <div className="absolute -top-3 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg border-4 border-background">
                  <Plus className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-xs mt-8 text-primary font-medium">Add</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle className="text-center">Quick Actions</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6">
                {/* Quick Actions */}
                <div className="flex flex-col items-center gap-4">
                  <MotionButton
                    className="w-full max-w-[280px] h-16 flex-col gap-2"
                    size="lg"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      router.push('/transactions');
                    }}
                  >
                    <CreditCard className="h-6 w-6" />
                    <span>Add Transaction</span>
                  </MotionButton>

                  <MotionButton
                    variant="outline"
                    className="w-full max-w-[280px] h-16 flex-col gap-2"
                    size="lg"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      router.push('/paychecks/create');
                    }}
                  >
                    <Receipt className="h-6 w-6" />
                    <span>Add Paycheck</span>
                  </MotionButton>

                  <MotionButton
                    variant="outline"
                    className="w-full max-w-[280px] h-16 flex-col gap-2"
                    size="lg"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      router.push('/categories');
                    }}
                  >
                    <Tag className="h-6 w-6" />
                    <span>New Category</span>
                  </MotionButton>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Right navigation items */}
          {mobileNavItems.slice(2, 3).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center min-h-[44px] active:bg-accent/50 transition-colors"
              >
                <item.icon
                  className={`h-5 w-5 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className={`text-xs mt-1 ${
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}>
                  {item.mobileLabel || item.name}
                </span>
              </Link>
            );
          })}

          {/* More Menu Drawer */}
          <Drawer>
            <DrawerTrigger asChild>
              <button className="flex flex-col items-center justify-center min-h-[44px] active:bg-accent/50 transition-colors">
                <Menu className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs mt-1 text-muted-foreground">More</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle className="text-center">More</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-4">
                {/* Menu Navigation Items */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    {menuNavItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <DrawerClose key={item.name} asChild>
                          <Link href={item.href}>
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start h-12"
                            >
                              <item.icon className="mr-3 h-5 w-5" />
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">{item.name}</span>
                                <span className="text-xs text-muted-foreground">{item.description}</span>
                              </div>
                            </Button>
                          </Link>
                        </DrawerClose>
                      );
                    })}
                  </div>
                </div>

                {/* Sign Out */}
                <div className="border-t pt-4">
                  <DrawerClose asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive h-12"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </DrawerClose>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </>
  );
}
