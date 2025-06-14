import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import FileUpload from "@/components/file-upload";
import FileGrid from "@/components/file-grid";
import { Card, CardContent } from "@/components/ui/card";
import { FileIcon, HardDriveIcon, RefreshCwIcon, LinkIcon } from "lucide-react";

interface Stats {
  totalFiles: number;
  totalSize: number;
  totalConversions: number;
  totalUrls: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentFiles, isLoading: filesLoading } = useQuery({
    queryKey: ["/api/media"],
  });

  const { data: recentConversions } = useQuery({
    queryKey: ["/api/conversions"],
  });

  const recentActivity = [
    ...(recentFiles?.slice(0, 3).map((file: any) => ({
      id: file.id,
      type: 'upload',
      filename: file.originalFilename,
      action: `Uploaded ${file.fileType}`,
      timestamp: new Date(file.uploadedAt),
    })) || []),
    ...(recentConversions?.slice(0, 2).map((conv: any) => ({
      id: conv.id,
      type: 'conversion',
      filename: `File ${conv.mediaFileId}`,
      action: `Converted to ${conv.toFormat}`,
      timestamp: new Date(conv.createdAt),
    })) || []),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);

  function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} day ago`;
  }

  return (
    <>
      <Header 
        title="Dashboard"
        subtitle="Manage your media files and conversions"
        showUploadButton={true}
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Files</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? "..." : stats?.totalFiles?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-green-600 text-sm font-medium">+12%</span>
                <span className="text-gray-500 text-sm ml-2">from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Storage Used</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? "..." : formatFileSize(stats?.totalSize || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <HardDriveIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: "62%" }}></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversions</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? "..." : stats?.totalConversions?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <RefreshCwIcon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-green-600 text-sm font-medium">+8</span>
                <span className="text-gray-500 text-sm ml-2">this week</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Generated URLs</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statsLoading ? "..." : stats?.totalUrls?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <LinkIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-green-600 text-sm font-medium">+24</span>
                <span className="text-gray-500 text-sm ml-2">today</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Upload Section */}
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Upload</h3>
              <FileUpload />
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-sm">No recent activity</p>
                ) : (
                  recentActivity.map((activity) => (
                    <div key={`${activity.type}-${activity.id}`} className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        activity.type === 'upload' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {activity.type === 'upload' ? (
                          <FileIcon className={`h-5 w-5 ${activity.type === 'upload' ? 'text-blue-600' : 'text-green-600'}`} />
                        ) : (
                          <RefreshCwIcon className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.filename}</p>
                        <p className="text-xs text-gray-500">{activity.action}</p>
                      </div>
                      <span className="text-xs text-gray-400">{getTimeAgo(activity.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Files */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Files</h3>
            </div>
            
            {filesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                    <div className="aspect-video bg-gray-200 rounded-lg mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : (
              <FileGrid files={recentFiles?.slice(0, 8) || []} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
