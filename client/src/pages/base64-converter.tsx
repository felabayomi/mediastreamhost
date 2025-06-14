import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Copy, Check, ExternalLink, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

export default function Base64Converter() {
  const [base64Data, setBase64Data] = useState("");
  const [filename, setFilename] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState("");
  const { toast } = useToast();

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!base64Data.trim()) {
      toast({
        title: "Base64 Data Required",
        description: "Please paste your base64 image data",
        variant: "destructive",
      });
      return;
    }

    if (!filename.trim()) {
      toast({
        title: "Filename Required",
        description: "Please enter a filename for your image",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);
    try {
      const response = await fetch("/api/upload-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          base64: base64Data.trim(),
          filename: filename.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        toast({
          title: "Conversion Successful",
          description: `Image uploaded as ${filename}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Conversion failed");
      }
    } catch (error) {
      toast({
        title: "Conversion Failed",
        description: error instanceof Error ? error.message : "Unable to convert base64 data",
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

  const generateCurlCommand = () => {
    if (!base64Data.trim() || !filename.trim()) return "";
    
    return `curl -Method POST 'https://image.citydiscoverer.ai/api/upload-base64' \\
  -Headers @{ "Content-Type" = "application/json" } \\
  -Body '{ "base64": "${base64Data.trim()}", "filename": "${filename.trim()}" }'`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Base64 Converter"
        subtitle="Convert base64 image data to hosted URLs"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Conversion Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Convert Base64 to URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConvert} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Base64 Image Data
                  </label>
                  <Textarea
                    placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA..."
                    value={base64Data}
                    onChange={(e) => setBase64Data(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Paste the complete base64 string including the data:image prefix
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Filename
                  </label>
                  <Input
                    type="text"
                    placeholder="venetian_nights.png"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Include the file extension (.png, .jpg, .gif, etc.)
                  </p>
                </div>
                
                <Button 
                  type="submit"
                  disabled={!base64Data.trim() || !filename.trim() || isConverting}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isConverting ? "Converting..." : "Convert to URL"}
                </Button>
              </form>

              {result && (
                <div className="mt-6 space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Your Hosted URL:</span>
                    <Badge variant="secondary">Ready to Use</Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={result.embeddableUrl || result.url}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(result.embeddableUrl || result.url)}
                    >
                      {copiedUrl === (result.embeddableUrl || result.url) ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(result.embeddableUrl || result.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>

                  {result.variations && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Available Sizes:</span>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(result.variations).map(([size, url]) => (
                          <div key={size} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-20 capitalize">{size}:</span>
                            <Input
                              value={url as string}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(url as string)}
                            >
                              {copiedUrl === url ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-white">
                  <img 
                    src={result.embeddableUrl || result.url} 
                    alt="Converted image"
                    className="max-w-full h-auto rounded-lg shadow-sm"
                    onError={(e) => {
                      console.error('Image preview failed:', e);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* cURL Command Generator */}
          <Card>
            <CardHeader>
              <CardTitle>API Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  PowerShell cURL Command:
                </label>
                <Textarea
                  value={generateCurlCommand()}
                  readOnly
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="Fill in the base64 data and filename above to generate the cURL command"
                />
                {base64Data.trim() && filename.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generateCurlCommand())}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy cURL Command
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage Examples */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Step 1: Get Base64 Data</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    Copy the complete base64 string from your source (including data:image prefix)
                  </p>
                  <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block">
                    data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...
                  </code>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Step 2: Choose Filename</h4>
                  <p className="text-sm text-green-800 mb-2">
                    Enter your desired filename with extension
                  </p>
                  <code className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded block">
                    venetian_nights.png
                  </code>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">Step 3: Get Hosted URL</h4>
                  <p className="text-sm text-purple-800 mb-2">
                    Click convert to get your permanent hosted URL:
                  </p>
                  <code className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded block">
                    https://image.citydiscoverer.ai/api/media/serve/venetian_nights.png
                  </code>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Features:</h4>
                  <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                    <li><strong>Permanent storage:</strong> Files saved to your media library</li>
                    <li><strong>Dynamic resizing:</strong> Add ?w=300&h=200 for different sizes</li>
                    <li><strong>API ready:</strong> Use the generated cURL commands</li>
                    <li><strong>Your domain:</strong> All URLs use image.citydiscoverer.ai</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}