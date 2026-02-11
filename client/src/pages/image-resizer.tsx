import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Tablet, Download, Copy, Check, Loader2, Upload, ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

const RESIZE_MODES = [
  { value: "scale", label: "Scale (keep proportions)", description: "Resize to fit width, height adjusts automatically" },
  { value: "stretch", label: "Stretch to exact size", description: "Stretch image to exact dimensions" },
  { value: "crop", label: "Crop to fill", description: "Fill dimensions, crop excess" },
  { value: "contain", label: "Fit with padding", description: "Fit inside with background padding" },
];

const DEVICE_SIZES = {
  iphone: [
    { name: "iPhone 6.5\" (1242x2688)", width: 1242, height: 2688 },
    { name: "iPhone 6.5\" (2688x1242)", width: 2688, height: 1242 },
    { name: "iPhone 6.7\" (1284x2778)", width: 1284, height: 2778 },
    { name: "iPhone 6.7\" (2778x1284)", width: 2778, height: 1284 },
  ],
  ipad: [
    { name: "iPad Pro 11\"", width: 1668, height: 2224 },
    { name: "iPad Pro 11\" (Landscape)", width: 2224, height: 1668 },
    { name: "iPad Pro 12.9\" (2064x2752)", width: 2064, height: 2752 },
    { name: "iPad Pro 12.9\" (2752x2064)", width: 2752, height: 2064 },
    { name: "iPad Pro 13\" (2048x2732)", width: 2048, height: 2732 },
    { name: "iPad Pro 13\" (2732x2048)", width: 2732, height: 2048 },
  ],
};

interface ResizedImage {
  size: string;
  width: number;
  height: number;
  url: string;
  localUrl: string;
}

export default function ImageResizer() {
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ResizedImage[]>([]);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [resizeMode, setResizeMode] = useState("scale");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

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

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      setImageUrl("");
      toast({
        title: "Image Loaded",
        description: "Image ready for resizing",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
          e.preventDefault();
          return;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  const clearImage = () => {
    setUploadedImage(null);
    setImageUrl("");
    setResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResize = async () => {
    const imageSource = uploadedImage || imageUrl.trim();
    
    if (!imageSource) {
      toast({
        title: "No Image",
        description: "Please upload an image or enter a URL",
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
          // Send base64 directly or URL - server handles both
          const requestBody = uploadedImage 
            ? { base64: uploadedImage, width: size.width, height: size.height, mode: resizeMode }
            : { url: imageUrl, width: size.width, height: size.height, mode: resizeMode };

          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

          const response = await fetch('/api/resize-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Resize failed for ${size.name}:`, response.status, errorData);
            throw new Error(errorData.details || errorData.error || `Failed to resize for ${size.name}`);
          }

          const data = await response.json();
          
          resizedImages.push({
            size: size.name,
            width: size.width,
            height: size.height,
            url: data.url,
            localUrl: data.localUrl,
          });
        } catch (error: any) {
          const errorMessage = error.name === 'AbortError' 
            ? 'Request timed out - image may be too large'
            : error.message || 'Could not resize for this dimension';
          console.error(`Error resizing for ${size.name}:`, error);
          toast({
            title: `Failed: ${size.name}`,
            description: errorMessage,
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
      const response = await fetch(result.localUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${result.size.replace(/[^a-zA-Z0-9]/g, '_')}_${result.width}x${result.height}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      
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

  const downloadAll = async () => {
    for (const result of results) {
      await downloadImage(result);
    }
  };

  const hasImage = uploadedImage || imageUrl.trim();

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
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Add Your Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadedImage ? (
                <div className="relative">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded" 
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={clearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="text-center mt-2">
                    <Badge variant="secondary">Image Ready</Badge>
                  </div>
                </div>
              ) : (
                <div
                  ref={dropAreaRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-700">
                    Drop an image here, click to upload, or paste (Ctrl+V)
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports JPG, PNG, GIF, WebP
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or enter URL</span>
                </div>
              </div>

              <Input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) setUploadedImage(null);
                }}
                disabled={!!uploadedImage}
                className="font-mono text-sm"
              />
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resize Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={resizeMode} onValueChange={setResizeMode}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESIZE_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{mode.label}</span>
                        <span className="text-xs text-gray-500">{mode.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handleResize}
              disabled={isProcessing || !hasImage || selectedSizes.size === 0}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Resized Images</CardTitle>
                <Button onClick={downloadAll} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((result, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <div className="aspect-video bg-gray-100 relative">
                        <img
                          src={result.localUrl}
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
