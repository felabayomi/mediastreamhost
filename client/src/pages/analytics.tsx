import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, BarChart3, FileImage, HardDrive, RefreshCw, TrendingUp } from "lucide-react";

interface StatsSummary {
  totalFiles: number;
  totalSize: number;
  totalConversions: number;
  totalUrls: number;
}

interface MediaFileRecord {
  id: number;
  fileType?: string;
  size?: number;
  uploadedAt?: string;
}

interface ConversionRecord {
  id: number;
  status?: string;
  createdAt?: string;
  mediaFileId?: number;
  fromFormat?: string;
  toFormat?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const value = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / 1024 ** value;
  return `${size.toFixed(size >= 10 || value === 0 ? 0 : 1)} ${units[value]}`;
}

export default function Analytics() {
  const { data: stats, isLoading: isStatsLoading, isError: isStatsError } = useQuery<StatsSummary>({
    queryKey: ["/api/stats"],
  });

  const { data: mediaFiles = [], isLoading: isMediaLoading } = useQuery<MediaFileRecord[]>({
    queryKey: ["/api/media"],
  });

  const { data: conversions = [], isLoading: isConversionsLoading } = useQuery<ConversionRecord[]>({
    queryKey: ["/api/conversions"],
  });

  const summary = useMemo(() => {
    const fileCounts = { image: 0, video: 0, other: 0 };
    mediaFiles.forEach((file) => {
      const type = file.fileType?.toLowerCase();
      if (type === "image") fileCounts.image += 1;
      else if (type === "video") fileCounts.video += 1;
      else fileCounts.other += 1;
    });

    const statusCounts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    conversions.forEach((item) => {
      const status = (item.status || "pending").toLowerCase();
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts] += 1;
      } else {
        statusCounts.pending += 1;
      }
    });

    const recentlyCreated = conversions
      .filter((item) => item.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 5);

    return {
      totalMedia: stats?.totalFiles ?? mediaFiles.length,
      totalStorage: stats?.totalSize ?? mediaFiles.reduce((sum, file) => sum + (file.size ?? 0), 0),
      totalConversions: stats?.totalConversions ?? conversions.length,
      generatedUrls: stats?.totalUrls ?? 0,
      fileCounts,
      statusCounts,
      recent: recentlyCreated,
    };
  }, [mediaFiles, conversions, stats]);

  const loading = isStatsLoading || isMediaLoading || isConversionsLoading;

  return (
    <>
      <Header title="Analytics" subtitle="Track media usage, conversion output, and storage activity." />

      <main className="flex-1 overflow-y-auto p-6">
        {isStatsError ? (
          <Card className="border border-red-200 bg-red-50">
            <CardContent className="p-8 text-red-700">
              Analytics data could not be loaded. Please try again shortly.
            </CardContent>
          </Card>
        ) : loading ? (
          <Card className="border border-gray-200">
            <CardContent className="p-8 text-gray-600">Loading analytics…</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Media files</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{summary.totalMedia}</p>
                    </div>
                    <div className="rounded-lg bg-blue-100 p-3 text-blue-600"><FileImage className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Storage used</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{formatBytes(summary.totalStorage)}</p>
                    </div>
                    <div className="rounded-lg bg-green-100 p-3 text-green-600"><HardDrive className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Conversions</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{summary.totalConversions}</p>
                    </div>
                    <div className="rounded-lg bg-amber-100 p-3 text-amber-600"><RefreshCw className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Generated URLs</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{summary.generatedUrls}</p>
                    </div>
                    <div className="rounded-lg bg-purple-100 p-3 text-purple-600"><TrendingUp className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Media by type</h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summary.fileCounts).map(([key, value]) => (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
                          <span className="capitalize">{key}</span>
                          <span>{value}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${(value / Math.max(summary.totalMedia, 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Conversion activity</h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summary.statusCounts).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm text-gray-700">
                        <span className="capitalize">{key}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-gray-200">
              <CardContent className="p-5">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent conversion activity</h3>
                {summary.recent.length === 0 ? (
                  <p className="text-sm text-gray-500">No conversion history yet. Upload and convert media to populate this feed.</p>
                ) : (
                  <div className="space-y-3">
                    {summary.recent.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.fromFormat ?? "unknown"} → {item.toFormat ?? "unknown"}</p>
                          <p className="text-xs text-gray-500">Created {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium capitalize text-blue-700">
                          {item.status ?? "pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
