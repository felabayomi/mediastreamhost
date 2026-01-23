import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Gauge, 
  UploadIcon, 
  ImagesIcon, 
  ServerCog, 
  LinkIcon, 
  ChartBarIcon,
  CloudUploadIcon,
  UserIcon,
  SettingsIcon,
  Smartphone,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Gauge },
  { name: "Upload Files", href: "/upload", icon: UploadIcon },
  { name: "Paste to URL", href: "/paste", icon: LinkIcon },
  { name: "Media Library", href: "/media", icon: ImagesIcon },
  { name: "Image Resizer", href: "/resize", icon: Smartphone },
  { name: "Conversions", href: "/conversions", icon: ServerCog },
  { name: "Analytics", href: "/analytics", icon: ChartBarIcon },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <CloudUploadIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MediaHost</h1>
              <p className="text-sm text-gray-500">Pro</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                onClick={closeSidebar}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? "text-blue-600 bg-blue-50" 
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                <span className={isActive ? "font-medium" : ""}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">John Doe</p>
              <p className="text-xs text-gray-500">Pro Plan</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
