import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import FileGrid from "@/components/file-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchIcon } from "lucide-react";

export default function MediaLibrary() {
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState<string>("");

  const { data: files, isLoading } = useQuery({
    queryKey: ["/api/media", { search, type: fileType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (fileType) params.append('type', fileType);
      
      const response = await fetch(`/api/media?${params}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
  });

  return (
    <>
      <Header 
        title="Media Library"
        subtitle="Manage all your uploaded files"
        showUploadButton={true}
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Your Files</h3>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-64"
                  />
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                    <div className="aspect-video bg-gray-200 rounded-lg mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : files?.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No files found</p>
                {search || fileType ? (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFileType("");
                    }}
                    className="text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : (
              <FileGrid files={files} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
