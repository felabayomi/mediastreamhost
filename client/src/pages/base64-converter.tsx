import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Copy, Check, ExternalLink, Upload, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

export default function Base64Converter() {
  const [imageUrl, setImageUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [proxyUrl, setProxyUrl] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");
  const { toast } = useToast();

  // Auto-extract filename when URL changes
  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    
    if (url.trim()) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const segments = pathname.split('/');
        const lastSegment = segments[segments.length - 1];
        
        if (lastSegment) {
          // Remove file extension if present
          const filenameWithoutExt = lastSegment.includes('.') 
            ? lastSegment.substring(0, lastSegment.lastIndexOf('.'))
            : lastSegment;
          
          if (filenameWithoutExt) {
            setFilename(filenameWithoutExt);
          }
        }
      } catch (error) {
        // Invalid URL, ignore auto-extraction
      }
    }
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      toast({
        title: "Image URL Required",
        description: "Please enter a valid HTTP/HTTPS image URL",
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

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTP/HTTPS URL",
        variant: "destructive",
      });
      return;
    }

    // Generate both commands and proxy URL
    const powerShellCommand = generatePowerShellCommand();
    const curlCommand = generateCurlCommand();
    const imageProxyUrl = `https://image-proxy-52mx.onrender.com/api/media/serve/${filename.trim()}`;
    setResult({ powerShellCommand, curlCommand });
    setProxyUrl(imageProxyUrl);
    
    toast({
      title: "Commands Generated",
      description: "PowerShell, curl commands and proxy URL ready",
    });
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

  const generatePowerShellCommand = () => {
    if (!imageUrl.trim() || !filename.trim()) return "";
    
    return `Invoke-WebRequest -Method POST 'https://image-proxy-52mx.onrender.com/api/upload-from-url' \`
  -Headers @{ 'Content-Type' = 'application/json' } \`
  -Body '{ "url": "${imageUrl.trim()}", "filename": "${filename.trim()}" }'`;
  };

  const generateCurlCommand = () => {
    if (!imageUrl.trim() || !filename.trim()) return "";
    
    return `curl -X POST "https://image-proxy-52mx.onrender.com/api/upload-from-url" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "${imageUrl.trim()}", "filename": "${filename.trim()}"}'`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Command Generator"
        subtitle="Generate PowerShell and curl commands to upload images from URLs"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Conversion Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Generate Commands & URLs
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
                    placeholder="https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png"
                    value={imageUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUrlChange("https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png")}
                    >
                      Test URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageUrl("");
                        setFilename("");
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter a valid HTTP/HTTPS URL that the server can fetch from
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Filename
                  </label>
                  <Input
                    type="text"
                    placeholder="city-scape"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilename("city-scape")}
                    >
                      Test Filename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilename("")}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Auto-filled from URL or enter custom filename (no extension needed)
                  </p>
                </div>
                
                <Button 
                  type="submit"
                  disabled={!imageUrl.trim() || !filename.trim()}
                  className="w-full"
                >
                  <Link className="h-4 w-4 mr-2" />
                  Generate Commands & URLs
                </Button>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {result && (
                  <>
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700">PowerShell Command:</span>
                        <Badge variant="secondary">Windows</Badge>
                      </div>
                      
                      <Textarea
                        value={result.powerShellCommand}
                        readOnly
                        rows={4}
                        className="font-mono text-sm"
                      />
                      
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(result.powerShellCommand)}
                        className="w-full"
                      >
                        {copiedUrl === result.powerShellCommand ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        Copy PowerShell Command
                      </Button>
                    </div>

                    <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-700">Curl Command:</span>
                        <Badge variant="secondary">Replit Shell</Badge>
                      </div>
                      
                      <Textarea
                        value={result.curlCommand}
                        readOnly
                        rows={4}
                        className="font-mono text-sm"
                      />
                      
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(result.curlCommand)}
                        className="w-full"
                      >
                        {copiedUrl === result.curlCommand ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        Copy Curl Command
                      </Button>
                    </div>
                  </>
                )}

                {proxyUrl && (
                  <div className="space-y-3 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700">Image Proxy URL:</span>
                      <Badge variant="secondary">Direct Access</Badge>
                    </div>
                    
                    <Input
                      value={proxyUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(proxyUrl)}
                        className="flex-1"
                      >
                        {copiedUrl === proxyUrl ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        Copy URL
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => window.open(proxyUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-xs text-green-600">
                      <p><strong>Use this URL after running the PowerShell command</strong></p>
                      <p>This will be the hosted image location on image-proxy-52mx.onrender.com</p>
                    </div>
                  </div>
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
                  <h4 className="font-medium text-blue-900 mb-2">Step 1: Paste Base64 Data</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    Copy the complete base64 string (including data:image prefix)
                  </p>
                  <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block">
                    data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...
                  </code>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Step 2: Enter Filename</h4>
                  <p className="text-sm text-green-800 mb-2">
                    Choose your desired filename with extension
                  </p>
                  <code className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded block">
                    gpt_image.png
                  </code>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">Step 3: Get Both Commands</h4>
                  <p className="text-sm text-purple-800 mb-2">
                    You'll get two outputs:
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-purple-800">PowerShell Upload Command:</p>
                      <code className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded block">
                        curl -Method POST 'https://image-proxy-52mx.onrender.com/api/upload-base64' ...
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-purple-800">Image Proxy URL:</p>
                      <code className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded block">
                        https://image-proxy-52mx.onrender.com/api/media/serve/gpt_image.png
                      </code>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Workflow:</h4>
                  <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-1">
                    <li>Run the PowerShell command to upload the base64 image</li>
                    <li>Use the proxy URL to access the hosted image</li>
                    <li>The proxy URL works immediately after successful upload</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}