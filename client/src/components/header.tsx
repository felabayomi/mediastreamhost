import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PlusIcon, BellIcon } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle: string;
  showUploadButton?: boolean;
}

export default function Header({ title, subtitle, showUploadButton = false }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-4">
          {showUploadButton && (
            <Link href="/upload">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <PlusIcon className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </Link>
          )}
          <button className="p-2 text-gray-400 hover:text-gray-600">
            <BellIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
