import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/header";
import FileGrid from "@/components/file-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchIcon, RefreshCwIcon, SparklesIcon, CheckCircleIcon, LoaderIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function MediaLibrary() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileType, setFileType] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search: only fire a query 400ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: files, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/media", { search: debouncedSearch, type: fileType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (fileType && fileType !== 'all') params.append('type', fileType);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        const response = await fetch(`/api/media?${params}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Failed to fetch files');
        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 60000,
    retry: 2,
    retryDelay: 1000,
  });

  const { data: aiStatus, refetch: refetchAiStatus } = useQuery({
    queryKey: ["/api/media/ai-status"],
    staleTime: 30000,
  });

  const analyzed = (aiStatus as any)?.analyzed ?? 0;
  const total = (aiStatus as any)?.total ?? 0;
  const pending = (aiStatus as any)?.pending ?? 0;
  const allAnalyzed = total > 0 && pending === 0;

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Poll status every 3s while analysis is running
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      refetchAiStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [isAnalyzing, refetchAiStatus]);

  // Stop polling when all done
  useEffect(() => {
    if (isAnalyzing && pending === 0 && total > 0) {
      setIsAnalyzing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "AI analysis complete!", description: `All ${total} images are now searchable by content.` });
    }
  }, [pending, total, isAnalyzing]);

  const analyzeAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/media/analyze-all"),
    onSuccess: (data: any) => {
      const newTotal = data?.total ?? 0;
      if (newTotal === 0) {
        toast({ title: "All images already analyzed", description: "Nothing new to process." });
      } else {
        setIsAnalyzing(true);
        refetchAiStatus();
      }
    },
    onError: () => {
      toast({ title: "Analysis failed", description: "Could not start AI analysis.", variant: "destructive" });
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
        {/* AI Search Banner */}
        {total > 0 && (
          <div className={`mb-4 rounded-lg border px-4 py-3 flex items-center justify-between gap-4 ${allAnalyzed ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                {allAnalyzed ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600 shrink-0" />
                ) : isAnalyzing ? (
                  <LoaderIcon className="h-4 w-4 text-blue-600 shrink-0 animate-spin" />
                ) : (
                  <SparklesIcon className="h-4 w-4 text-blue-600 shrink-0" />
                )}
                <span className={allAnalyzed ? 'text-green-800' : 'text-blue-800'}>
                  <strong>AI visual search</strong>
                  {allAnalyzed
                    ? ` — all ${total} images indexed. Search by what's in your images, logos, text, scenes, and more.`
                    : isAnalyzing
                      ? ` — analyzing… ${analyzed} of ${total} done (${pending} remaining)`
                      : ` — ${analyzed} of ${total} images indexed. Analyze remaining ${pending} to search by image content.`}
                </span>
              </div>
              {/* Progress bar shown while analyzing */}
              {isAnalyzing && total > 0 && (
                <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((analyzed / total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            {!allAnalyzed && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => analyzeAllMutation.mutate()}
                disabled={analyzeAllMutation.isPending || isAnalyzing}
              >
                {isAnalyzing ? (
                  <><LoaderIcon className="h-3 w-3 mr-1 animate-spin" /> Running…</>
                ) : analyzeAllMutation.isPending ? (
                  <><LoaderIcon className="h-3 w-3 mr-1 animate-spin" /> Starting…</>
                ) : (
                  <><SparklesIcon className="h-3 w-3 mr-1" /> Analyze All</>
                )}
              </Button>
            )}
          </div>
        )}

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Your Files</h3>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder={analyzed > 0 ? "Search by name or image content…" : "Search files…"}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-72"
                  />
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCwIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
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
                {(search || fileType !== 'all') && (
                  <button
                    onClick={() => { setSearch(""); setFileType("all"); }}
                    className="text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Clear filters
                  </button>
                )}
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
