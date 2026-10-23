import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CircleDashed, Clock3, FileImage, RefreshCcw, UploadCloud } from "lucide-react";

interface ConversionRecord {
  id: number;
  mediaFileId: number;
  fromFormat: string;
  toFormat: string;
  status: string;
  progress: number;
  outputPath?: string | null;
  embeddableUrl?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

const statusClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function Conversions() {
  const { data, isLoading, isError } = useQuery<ConversionRecord[]>({
    queryKey: ["/api/conversions"],
  });

  const records = data ?? [];

  return (
    <>
      <Header title="Conversions" subtitle="Review conversion jobs, output status, and generated media." />

      <main className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <Card className="border border-gray-200">
            <CardContent className="p-8 text-gray-600">Loading conversion history…</CardContent>
          </Card>
        ) : isError ? (
          <Card className="border border-red-200 bg-red-50">
            <CardContent className="p-8 text-red-700">
              Unable to load conversions right now. Please try again shortly.
            </CardContent>
          </Card>
        ) : records.length === 0 ? (
          <Card className="border border-dashed border-gray-300 bg-gray-50">
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <UploadCloud className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">No conversion records yet</h3>
              <p className="mt-2 text-sm text-gray-600">
                Upload media and convert a file to create your first conversion history entry.
              </p>
              <div className="mt-6">
                <Link href="/upload">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Upload media
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {records.map((item) => (
              <Card key={item.id} className="border border-gray-200">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        <FileImage className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Conversion #{item.id}</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {item.fromFormat.toUpperCase()} → {item.toFormat.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-500">Media file #{item.mediaFileId}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusClasses[item.status] ?? "bg-gray-100 text-gray-800"}`}>
                        {item.status}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Clock3 className="h-4 w-4" />
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Progress</p>
                      <div className="mt-2 flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">{item.progress ?? 0}%</span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Completed</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{formatTime(item.completedAt)}</p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Output</p>
                      {item.embeddableUrl ? (
                        <a
                          href={item.embeddableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          Open file
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Not ready yet</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
