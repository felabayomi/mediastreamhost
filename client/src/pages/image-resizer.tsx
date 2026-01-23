import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Tablet, Download, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

const DEVICE_SIZES = {
  iphone: [
    { name: "iPhone 15 Pro Max", width: 1290, height: 2796 },
    { name: "iPhone 15 Pro Max (Landscape)", width: 2796, height: 1290 },
    { name: "iPhone 15 Plus", width: 1320, height: 2868 },
    { name: "iPhone 15 Plus (Landscape)", width: 2868, height: 1320 },
    { name: "iPhone 14 Pro Max", width: 1260, height: 2736 },
    { name: "iPhone 14 Pro Max (Landscape)", width: 2736, height: 1260 },
  ],
  ipad: [
    { name: "iPad Pro 11\"", width: 1668, height: 2224 },
    { name: "iPad Pro 11\" (Landscape)", width: 2224, height: 1668 },
  ],
};

interface ResizedImage {
  size: string;
  width: number;
  height: number;
  url: string;
  blob?: Blob;
}

export default function ImageResizer() {
  const [imageUrl, setImageUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ResizedImage[]>([]);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleSize = (sizeName: string) => {
    const newSelected = new Set(selectedSizes);
    if (newSelected.has(sizeName)) {
      newSelected.delete(sizeName);
    } else {
      newSelected.add(sizeName);
    }
    setSelectedSizes(newSelected);
  };

  const selectAllIphone = () => {
    const newSelected = new Set(selectedSizes);
    DEVICE_SIZES.iphone.forEach(size => newSelected.add(size.name));
    setSelectedSizes(newSelected);
  };

  const selectAllIpad = () => {
    const newSelected = new Set(selectedSizes);
    DEVICE_SIZES.ipad.forEach(size => newSelected.add(size.name));
    setSelectedSizes(newSelected);
  };

  const clearSelection = () => {
    setSelectedSizes(new Set());
  };

  const handleResize = async () => {
    if (!imageUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter an image URL",
        variant: "destructive",
      });
      return;
    }

    if (selectedSizes.size === 0) {
      toast({
        title: "No Sizes Selected",
        description: "Please select at least one device size",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const allSizes = [...DEVICE_SIZES.iphone, ...DEVICE_SIZES.ipad];
      const sizesToProcess = allSizes.filter(size => selectedSizes.has(size.name));

      const resizedImages: ResizedImage[] = [];

      for (const size of sizesToProcess) {
        try {
          const response = await fetch('/api/resize-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: imageUrl,
              width: size.width,
              height: size.height,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to resize for ${size.name}`);
          }

          const data = await response.json();
          
          resizedImages.push({
            size: size.name,
            width: size.width,
            height: size.height,
            url: data.url,
          });
        } catch (error) {
          console.error(`Error resizing for ${size.name}:`, error);
          toast({
            title: `Failed: ${size.name}`,
            description: "Could not resize for this dimension",
            variant: "destructive",
          });
        }
      }

      setResults(resizedImages);

      if (resizedImages.length > 0) {
        toast({
          title: "Images Resized",
          description: `Successfully created ${resizedImages.length} resized images`,
        });
      }
    } catch (error) {
      console.error('Resize error:', error);
      toast({
        title: "Resize Failed",
        description: error instanceof Error ? error.message : "Failed to resize image",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
        description: "Unable to copy URL",
        variant: "destructive",
      });
    }
  };

  const downloadImage = async (result: ResizedImage) => {
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.size.replace(/[^a-zA-Z0-9]/g, '_')}_${result.width}x${result.height}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded",
        description: `${result.size} image saved`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to download image",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Image Resizer"
        subtitle="Resize images to specific iPhone and iPad dimensions"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enter Image URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="url"
                placeholder="https://example.com/image.jpg or paste from your media library"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-sm text-gray-500">
                Enter any image URL or use a URL from your Media Library
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  iPhone Sizes
                </CardTitle>
                <Button variant="outline" size="sm" onClick={selectAllIphone}>
                  Select All
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {DEVICE_SIZES.iphone.map((size) => (
                  <div
                    key={size.name}
                    onClick={() => toggleSize(size.name)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSizes.has(size.name)
                        ? "bg-blue-50 border-blue-300"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{size.name}</span>
                      <Badge variant={selectedSizes.has(size.name) ? "default" : "secondary"}>
                        {size.width} x {size.height}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Tablet className="h-5 w-5" />
                  iPad Sizes
                </CardTitle>
                <Button variant="outline" size="sm" onClick={selectAllIpad}>
                  Select All
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {DEVICE_SIZES.ipad.map((size) => (
                  <div
                    key={size.name}
                    onClick={() => toggleSize(size.name)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSizes.has(size.name)
                        ? "bg-blue-50 border-blue-300"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{size.name}</span>
                      <Badge variant={selectedSizes.has(size.name) ? "default" : "secondary"}>
                        {size.width} x {size.height}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleResize}
              disabled={isProcessing || !imageUrl.trim() || selectedSizes.size === 0}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resizing Images...
                </>
              ) : (
                <>Resize to Selected Sizes ({selectedSizes.size})</>
              )}
            </Button>
            {selectedSizes.size > 0 && (
              <Button variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            )}
          </div>

          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resized Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((result, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <div className="aspect-video bg-gray-100 relative">
                        <img
                          src={result.url}
                          alt={result.size}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{result.size}</span>
                          <Badge variant="secondary">
                            {result.width} x {result.height}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => copyToClipboard(result.url)}
                          >
                            {copiedUrl === result.url ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            Copy URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadImage(result)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
