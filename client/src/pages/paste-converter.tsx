import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardIcon, Copy, Check, ExternalLink, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";

export default function PasteConverter() {
  const [filename, setFilename] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const { toast } = useToast();
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    const items = e.clipboardData?.items;
    
    if (!items) {
      toast({
        title: "Paste Failed",
        description: "No clipboard data found",
        variant: "destructive",
      });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setPastedImage(base64);
            
            // Auto-generate filename if not provided
            if (!filename.trim()) {
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
              setFilename(`pasted-image-${timestamp}.png`);
            }
            
            toast({
              title: "Image Pasted",
              description: "Image ready for conversion",
            });
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pastedImage) {
      toast({
        title: "No Image",
        description: "Please paste an image first",
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
      const response = await apiRequest("POST", "/api/upload-base64", {
        base64: pastedImage,
        filename: filename.trim()
      });

      const data = await response.json();

      setResult(data);
      
      toast({
        title: "Conversion Successful",
        description: "Your image has been converted to a URL",
      });
    } catch (error) {
      console.error('Paste conversion error:', error);
      toast({
        title: "Conversion Failed",
        description: error instanceof Error ? error.message : "Failed to convert image",
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

  const clearPastedImage = () => {
    setPastedImage(null);
    setResult(null);
    setFilename("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Paste to URL Converter"
        subtitle="Paste images from clipboard and convert to hosted URLs"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Paste Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardIcon className="h-5 w-5" />
                Paste Image Area
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={pasteAreaRef}
                onPaste={handlePaste}
                tabIndex={0}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
              >
                {pastedImage ? (
                  <div className="space-y-4">
                    <img 
                      src={pastedImage} 
                      alt="Pasted image" 
                      className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                    />
                    <div className="flex gap-2 justify-center">
                      <Badge variant="secondary">Image Ready</Badge>
                      <Button variant="outline" size="sm" onClick={clearPastedImage}>
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ImageIcon className="h-16 w-16 mx-auto text-gray-400" />
                    <div>
                      <p className="text-lg font-medium text-gray-700">
                        Click here and paste your image
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Use Ctrl+V (or Cmd+V on Mac) to paste an image from your clipboard
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Conversion Form */}
          {pastedImage && (
            <Card>
              <CardHeader>
                <CardTitle>Convert to URL</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConvert} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Filename
                    </label>
                    <Input
                      type="text"
                      placeholder="my-image.png"
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
                    disabled={!pastedImage || !filename.trim() || isConverting}
                    className="w-full"
                  >
                    <ClipboardIcon className="h-4 w-4 mr-2" />
                    {isConverting ? "Converting..." : "Convert to URL"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Conversion Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700">Direct URL:</span>
                    <Badge variant="secondary">Ready to Use</Badge>
                  </div>
                  
                  <Input
                    value={result.directUrl || result.embeddableUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(result.directUrl || result.embeddableUrl)}
                      className="flex-1"
                    >
                      {copiedUrl === (result.directUrl || result.embeddableUrl) ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copy URL
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(result.directUrl || result.embeddableUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {result.variations && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Size Variations:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(result.variations).map(([name, url]) => (
                        <div key={name} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium capitalize">{name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(url as string)}
                            >
                              {copiedUrl === url ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                          <Input
                            value={url as string}
                            readOnly
                            className="font-mono text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}