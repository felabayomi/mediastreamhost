import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkIcon, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

export default function UrlConverter() {
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState("");
  const { toast } = useToast();

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    setIsConverting(true);
    try {
      const response = await fetch("/api/convert-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: imageUrl.trim(),
          title: title.trim() || "converted-image"
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        toast({
          title: "Conversion Successful",
          description: "Image has been converted to your media hosting service.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Conversion failed");
      }
    } catch (error) {
      toast({
        title: "Conversion Failed",
        description: error instanceof Error ? error.message : "Unable to convert image URL.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast({
        title: "Copied!",
        description: "URL copied to clipboard",
      });
      setTimeout(() => setCopiedUrl(""), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy URL to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="URL Converter"
        subtitle="Convert external image URLs to your media hosting service"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Conversion Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Convert Image URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConvert} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Image URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg or paste your GPT generated URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isConverting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Title (optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="best-of-spain-visual"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isConverting}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!imageUrl.trim() || isConverting}
                >
                  {isConverting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Converting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <LinkIcon className="h-4 w-4" />
                      <span>Convert to Media URL</span>
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Conversion Complete</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Primary URL</label>
                      <Badge variant="secondary">Full Size</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={result.variations.fullsize}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.variations.fullsize)}
                      >
                        {copiedUrl === result.variations.fullsize ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(result.variations.fullsize, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Thumbnail</label>
                      <Badge variant="secondary">300x300</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={result.variations.thumbnail}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.variations.thumbnail)}
                      >
                        {copiedUrl === result.variations.thumbnail ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Banner</label>
                      <Badge variant="secondary">1200x400</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={result.variations.banner}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.variations.banner)}
                      >
                        {copiedUrl === result.variations.banner ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Your image has been converted and is now hosted on your media service. 
                    You can use any of these URLs with dynamic parameters like ?w=800&h=600&fit=crop&crop=center
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}