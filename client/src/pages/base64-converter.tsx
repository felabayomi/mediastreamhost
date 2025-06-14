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

  const handleConvert = (e: React.FormEvent) => {
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

    // Generate the PowerShell command
    const curlCommand = generateCurlCommand();
    setResult({ curlCommand });
    
    toast({
      title: "Command Generated",
      description: "PowerShell cURL command ready to copy",
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

  const generateCurlCommand = () => {
    if (!base64Data.trim() || !filename.trim()) return "";
    
    return `curl -Method POST 'https://image.citydiscoverer.ai/api/upload-base64' \`
  -Headers @{ "Content-Type" = "application/json" } \`
  -Body '{ "base64": "${base64Data.trim()}", "filename": "${filename.trim()}" }'`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="PowerShell Command Generator"
        subtitle="Generate cURL commands for base64 image uploads"
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
                  disabled={!base64Data.trim() || !filename.trim()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Generate PowerShell Command
                </Button>
              </form>

              {result && (
                <div className="mt-6 space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">PowerShell cURL Command:</span>
                    <Badge variant="secondary">Ready to Copy</Badge>
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
                    Copy PowerShell Command
                  </Button>
                </div>
              )}
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
                  <h4 className="font-medium text-purple-900 mb-2">Step 3: Copy PowerShell Command</h4>
                  <p className="text-sm text-purple-800 mb-2">
                    Run the generated command in PowerShell to upload:
                  </p>
                  <code className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded block">
                    curl -Method POST 'https://image.citydiscoverer.ai/api/upload-base64' ...
                  </code>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Result:</h4>
                  <p className="text-sm text-yellow-800 mb-2">
                    After running the command, you'll get a hosted URL:
                  </p>
                  <code className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded block">
                    https://image.citydiscoverer.ai/api/media/serve/gpt_image.png
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}