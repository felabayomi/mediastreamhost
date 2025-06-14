import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkIcon, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

export default function ProxyDemo() {
  const [imageUrl, setImageUrl] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");
  const { toast } = useToast();

  const generateProxyUrl = () => {
    if (!imageUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter an image URL to proxy",
        variant: "destructive",
      });
      return;
    }

    const encodedUrl = encodeURIComponent(imageUrl.trim());
    // Use the current domain for the proxy URL instead of hardcoded domain
    const proxy = `/api/proxy/image?url=${encodedUrl}`;
    setProxyUrl(proxy);
    
    toast({
      title: "Proxy URL Generated",
      description: "Your image is now accessible through your domain",
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Image Proxy"
        subtitle="Serve external images through your domain without downloading"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Proxy Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Generate Proxy URL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  External Image URL (from ChatGPT, websites, etc.)
                </label>
                <Input
                  type="url"
                  placeholder="https://picsum.photos/800/600"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImageUrl("https://picsum.photos/800/600")}
                  >
                    Test URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImageUrl("")}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              
              <Button 
                onClick={generateProxyUrl}
                disabled={!imageUrl.trim()}
                className="w-full"
              >
                Generate Proxy URL
              </Button>

              {proxyUrl && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Your Proxy URL:</span>
                    <Badge variant="secondary">Ready to Use</Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={`https://image.citydiscoverer.ai${proxyUrl}`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`https://image.citydiscoverer.ai${proxyUrl}`)}
                    >
                      {copiedUrl === `https://image.citydiscoverer.ai${proxyUrl}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://image.citydiscoverer.ai${proxyUrl}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {proxyUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
                    <p><strong>Proxy URL:</strong> {proxyUrl}</p>
                    <p><strong>Original URL:</strong> {imageUrl}</p>
                    <p><strong>Status:</strong> Testing proxy functionality...</p>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="relative">
                      <img 
                        src={proxyUrl} 
                        alt="Proxied image"
                        className="max-w-full h-auto rounded-lg shadow-sm"
                        onLoad={() => {
                          console.log('Image loaded successfully via proxy:', proxyUrl);
                          toast({
                            title: "Proxy Working!",
                            description: "Image successfully loaded through your domain proxy",
                          });
                        }}
                        onError={(e) => {
                          console.error('Proxy image load failed');
                          console.error('Proxy URL:', proxyUrl);
                          console.error('Original URL:', imageUrl);
                          console.error('Error event:', e);
                          toast({
                            title: "Proxy Load Failed",
                            description: "Check the browser console for debugging details",
                            variant: "destructive",
                          });
                        }}
                      />
                      
                      <div className="mt-4 space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log('Testing proxy URL:', proxyUrl);
                            fetch(proxyUrl)
                              .then(response => {
                                console.log('Proxy response status:', response.status);
                                console.log('Proxy response headers:', response.headers);
                                return response.blob();
                              })
                              .then(blob => {
                                console.log('Proxy blob size:', blob.size, 'bytes');
                                console.log('Proxy blob type:', blob.type);
                                toast({
                                  title: "Proxy Test Result",
                                  description: `Retrieved ${blob.size} bytes of ${blob.type}`,
                                });
                              })
                              .catch(error => {
                                console.error('Proxy fetch error:', error);
                                toast({
                                  title: "Proxy Test Failed",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              });
                          }}
                        >
                          Test Proxy Fetch
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(proxyUrl, '_blank')}
                        >
                          Open Proxy URL
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p><strong>Benefits of using the proxy:</strong></p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>No need to download and re-upload images</li>
                      <li>Images served through your domain (image.citydiscoverer.ai)</li>
                      <li>Cached for 24 hours for better performance</li>
                      <li>Works with ChatGPT URLs and any external image</li>
                      <li>Bypasses CORS restrictions</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Examples */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">For ChatGPT Images:</h4>
                  <p className="text-sm text-blue-800">
                    Copy any ChatGPT image URL and paste it above. The proxy will serve it through your domain instantly.
                  </p>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">For Any External Image:</h4>
                  <p className="text-sm text-green-800">
                    Works with any publicly accessible image URL from any website or service.
                  </p>
                </div>
                
                <div className="p-3 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">URL Format:</h4>
                  <code className="text-sm text-purple-800 bg-purple-100 px-2 py-1 rounded">
                    https://image.citydiscoverer.ai/api/proxy/image?url=ENCODED_IMAGE_URL
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