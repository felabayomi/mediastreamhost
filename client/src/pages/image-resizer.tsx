import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Smartphone, Tablet, Download, Copy, Check, Loader2, Upload, ImageIcon, X, Monitor, Layout, ChevronDown, ChevronUp } from "lucide-react";
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

const GENERAL_SIZES = {
  social: [
    { name: "Instagram Post (1080x1080)", width: 1080, height: 1080 },
    { name: "Instagram Story (1080x1920)", width: 1080, height: 1920 },
    { name: "Facebook Post (1200x630)", width: 1200, height: 630 },
    { name: "Facebook Cover (820x312)", width: 820, height: 312 },
    { name: "Twitter Post (1200x675)", width: 1200, height: 675 },
    { name: "Twitter Header (1500x500)", width: 1500, height: 500 },
    { name: "LinkedIn Post (1200x627)", width: 1200, height: 627 },
    { name: "YouTube Thumbnail (1280x720)", width: 1280, height: 720 },
  ],
  web: [
    { name: "HD (1920x1080)", width: 1920, height: 1080 },
    { name: "4K (3840x2160)", width: 3840, height: 2160 },
    { name: "Banner (1200x300)", width: 1200, height: 300 },
    { name: "Thumbnail (150x150)", width: 150, height: 150 },
    { name: "Card (600x400)", width: 600, height: 400 },
    { name: "Hero (1440x600)", width: 1440, height: 600 },
    { name: "Open Graph (1200x630)", width: 1200, height: 630 },
    { name: "Favicon (512x512)", width: 512, height: 512 },
  ],
};

const MAX_SIZE_OPTIONS = [
  { value: '', label: 'No limit' },
  { value: '100', label: '100 KB' },
  { value: '250', label: '250 KB' },
  { value: '500', label: '500 KB' },
  { value: '1024', label: '1 MB' },
  { value: '2048', label: '2 MB' },
  { value: '5120', label: '5 MB' },
];

const MAX_IMAGES = 12;

interface UploadedImage {
  id: string;
  name: string;
  base64: string;
}

interface ResizedResult {
  sourceId: string;
  sourceName: string;
  size: string;
  width: number;
  height: number;
  url: string;
  localUrl: string;
  fileSize?: number;
}

export default function ImageResizer() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [results, setResults] = useState<ResizedResult[]>([]);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [resizeMode, setResizeMode] = useState("scale");
  const [quality, setQuality] = useState("90");
  const [maxFileSize, setMaxFileSize] = useState("");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [activeTab, setActiveTab] = useState<"device" | "general" | "custom">("general");
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  const toggleSize = (sizeName: string) => {
    const newSelected = new Set(selectedSizes);
    if (newSelected.has(sizeName)) newSelected.delete(sizeName);
    else newSelected.add(sizeName);
    setSelectedSizes(newSelected);
  };

  const selectGroup = (sizes: { name: string }[]) => {
    const newSelected = new Set(selectedSizes);
    sizes.forEach(size => newSelected.add(size.name));
    setSelectedSizes(newSelected);
  };

  const clearSelection = () => setSelectedSizes(new Set());

  const addCustomSize = () => {
    const w = parseInt(customWidth);
    const h = parseInt(customHeight);
    if (!w || !h || w < 1 || h < 1) {
      toast({ title: "Invalid Size", description: "Enter valid width and height", variant: "destructive" });
      return;
    }
    const name = `Custom (${w}x${h})`;
    setSelectedSizes(prev => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
    toast({ title: "Size Added", description: `${w}x${h} added to selection` });
  };

  const processFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const remaining = MAX_IMAGES - uploadedImages.length;
    const toProcess = imageFiles.slice(0, remaining);

    if (imageFiles.length > remaining) {
      toast({ title: "Limit Reached", description: `Only ${remaining} more image${remaining !== 1 ? 's' : ''} can be added (max ${MAX_IMAGES})`, variant: "destructive" });
    }

    let loaded = 0;
    const newImages: UploadedImage[] = [];

    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages.push({
          id: `${Date.now()}_${Math.random()}`,
          name: file.name,
          base64: e.target?.result as string,
        });
        loaded++;
        if (loaded === toProcess.length) {
          setUploadedImages(prev => [...prev, ...newImages]);
          setImageUrl("");
          if (toProcess.length > 0) {
            toast({ title: `${toProcess.length} Image${toProcess.length > 1 ? 's' : ''} Added`, description: `Ready to resize` });
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }, [uploadedImages.length, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      processFiles(files);
      e.preventDefault();
    }
  }, [processFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  const clearAll = () => {
    setUploadedImages([]);
    setImageUrl("");
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getAllSizes = () => {
    const allNamed = [...DEVICE_SIZES.iphone, ...DEVICE_SIZES.ipad, ...GENERAL_SIZES.social, ...GENERAL_SIZES.web];
    const sizes: { name: string; width: number; height: number }[] = [];
    for (const name of Array.from(selectedSizes)) {
      const found = allNamed.find(s => s.name === name);
      if (found) {
        sizes.push(found);
      } else {
        const match = name.match(/Custom \((\d+)x(\d+)\)/);
        if (match) sizes.push({ name, width: parseInt(match[1]), height: parseInt(match[2]) });
      }
    }
    return sizes;
  };

  const handleResize = async () => {
    const hasUploaded = uploadedImages.length > 0;
    const hasUrl = imageUrl.trim();
    if (!hasUploaded && !hasUrl) {
      toast({ title: "No Image", description: "Upload images or enter a URL", variant: "destructive" });
      return;
    }
    if (selectedSizes.size === 0) {
      toast({ title: "No Sizes Selected", description: "Select at least one size", variant: "destructive" });
      return;
    }

    const sizesToProcess = getAllSizes();
    const sources = hasUploaded
      ? uploadedImages
      : [{ id: 'url', name: imageUrl, base64: imageUrl }];

    const totalOps = sources.length * sizesToProcess.length;
    let completed = 0;

    setIsProcessing(true);
    setResults([]);
    setProgressValue(0);

    const allResults: ResizedResult[] = [];

    for (let si = 0; si < sources.length; si++) {
      const source = sources[si];
      const isUrl = source.id === 'url';

      for (let pi = 0; pi < sizesToProcess.length; pi++) {
        const size = sizesToProcess[pi];
        setProgressText(`Image ${si + 1}/${sources.length} — ${size.name}`);

        try {
          const requestBody: any = {
            width: size.width,
            height: size.height,
            mode: resizeMode,
            quality: parseInt(quality) || 90,
          };
          if (maxFileSize && maxFileSize !== 'none') requestBody.maxFileSize = parseInt(maxFileSize);
          if (isUrl) requestBody.url = source.name;
          else requestBody.base64 = source.base64;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000);

          const response = await fetch('/api/resize-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.details || errorData.error || `Failed`);
          }

          const data = await response.json();
          allResults.push({
            sourceId: source.id,
            sourceName: isUrl ? (source.name.split('/').pop() || source.name) : source.name,
            size: size.name,
            width: size.width,
            height: size.height,
            url: data.url,
            localUrl: data.localUrl,
            fileSize: data.fileSize,
          });
        } catch (error: any) {
          const msg = error.name === 'AbortError' ? 'Timed out' : (error.message || 'Failed');
          toast({ title: `Skipped: ${size.name}`, description: msg, variant: "destructive" });
        }

        completed++;
        setProgressValue(Math.round((completed / totalOps) * 100));
      }
    }

    setResults(allResults);
    setIsProcessing(false);
    setProgressText("");
    if (allResults.length > 0) {
      toast({ title: "Done!", description: `${allResults.length} image${allResults.length !== 1 ? 's' : ''} resized across ${sources.length} source${sources.length !== 1 ? 's' : ''}` });
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast({ title: "Copied!", description: "URL copied to clipboard" });
      setTimeout(() => setCopiedUrl(""), 2000);
    } catch {
      toast({ title: "Copy Failed", description: "Unable to copy URL", variant: "destructive" });
    }
  };

  const downloadImage = async (result: ResizedResult) => {
    try {
      const response = await fetch(result.localUrl);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${result.sourceName.replace(/\.[^.]+$/, '')}_${result.size.replace(/[^a-zA-Z0-9]/g, '_')}_${result.width}x${result.height}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast({ title: "Downloaded", description: `${result.size} saved` });
    } catch {
      toast({ title: "Download Failed", description: "Unable to download image", variant: "destructive" });
    }
  };

  const downloadAll = () => {
    results.forEach((result, i) => {
      setTimeout(() => downloadImage(result), i * 300);
    });
  };

  const downloadSourceImages = (sourceId: string) => {
    const sourceResults = results.filter(r => r.sourceId === sourceId);
    sourceResults.forEach((result, i) => {
      setTimeout(() => downloadImage(result), i * 300);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const toggleCollapse = (sourceId: string) => {
    setCollapsedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  const hasImage = uploadedImages.length > 0 || imageUrl.trim();

  const groupedResults = results.reduce<{ sourceId: string; sourceName: string; items: ResizedResult[] }[]>((acc, r) => {
    const existing = acc.find(g => g.sourceId === r.sourceId);
    if (existing) existing.items.push(r);
    else acc.push({ sourceId: r.sourceId, sourceName: r.sourceName, items: [r] });
    return acc;
  }, []);

  const renderSizeGrid = (sizes: { name: string; width: number; height: number }[]) => (
    <div className="space-y-2">
      {sizes.map((size) => (
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
            <span className="font-medium text-sm">{size.name}</span>
            <Badge variant={selectedSizes.has(size.name) ? "default" : "secondary"}>
              {size.width} x {size.height}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Image Resizer"
        subtitle="Resize up to 12 images at once — device, social media, web, or custom sizes"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Upload Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Images ({uploadedImages.length}/{MAX_IMAGES})
                </CardTitle>
                {(uploadedImages.length > 0 || imageUrl) && (
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-gray-500">
                    <X className="h-4 w-4 mr-1" /> Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Uploaded thumbnails grid */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={img.base64} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => removeImage(img.id)}
                          className="bg-red-500 rounded-full p-1 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                        <p className="text-white text-xs truncate">{img.name}</p>
                      </div>
                    </div>
                  ))}
                  {/* Add more button */}
                  {uploadedImages.length < MAX_IMAGES && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-400 mt-1">Add more</span>
                    </div>
                  )}
                </div>
              )}

              {/* Drop zone (only when no images or under limit) */}
              {uploadedImages.length === 0 && (
                <div
                  ref={dropAreaRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-700">
                    Drop images here, click to upload, or paste (Ctrl+V)
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Up to {MAX_IMAGES} images — JPG, PNG, GIF, WebP</p>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

              {/* URL input (only when no files uploaded) */}
              {uploadedImages.length === 0 && (
                <>
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
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="font-mono text-sm"
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Size tabs */}
          <div className="flex gap-2 flex-wrap">
            <Button variant={activeTab === "general" ? "default" : "outline"} onClick={() => setActiveTab("general")} className="flex items-center gap-2">
              <Monitor className="h-4 w-4" /> Social & Web
            </Button>
            <Button variant={activeTab === "device" ? "default" : "outline"} onClick={() => setActiveTab("device")} className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Device Sizes
            </Button>
            <Button variant={activeTab === "custom" ? "default" : "outline"} onClick={() => setActiveTab("custom")} className="flex items-center gap-2">
              <Layout className="h-4 w-4" /> Custom Size
            </Button>
          </div>

          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Social Media</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => selectGroup(GENERAL_SIZES.social)}>Select All</Button>
                </CardHeader>
                <CardContent>{renderSizeGrid(GENERAL_SIZES.social)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Web & General</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => selectGroup(GENERAL_SIZES.web)}>Select All</Button>
                </CardHeader>
                <CardContent>{renderSizeGrid(GENERAL_SIZES.web)}</CardContent>
              </Card>
            </div>
          )}

          {activeTab === "device" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> iPhone Sizes</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => selectGroup(DEVICE_SIZES.iphone)}>Select All</Button>
                </CardHeader>
                <CardContent>{renderSizeGrid(DEVICE_SIZES.iphone)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Tablet className="h-5 w-5" /> iPad Sizes</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => selectGroup(DEVICE_SIZES.ipad)}>Select All</Button>
                </CardHeader>
                <CardContent>{renderSizeGrid(DEVICE_SIZES.ipad)}</CardContent>
              </Card>
            </div>
          )}

          {activeTab === "custom" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom Dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">Enter any width and height you need.</p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label htmlFor="customWidth" className="text-sm font-medium">Width (px)</Label>
                    <Input id="customWidth" type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} placeholder="1920" min="1" />
                  </div>
                  <span className="pb-2 text-gray-400 font-bold">×</span>
                  <div className="flex-1">
                    <Label htmlFor="customHeight" className="text-sm font-medium">Height (px)</Label>
                    <Input id="customHeight" type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} placeholder="1080" min="1" />
                  </div>
                  <Button onClick={addCustomSize}>Add</Button>
                </div>
                {Array.from(selectedSizes).filter(s => s.startsWith("Custom")).length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-sm font-medium">Your Custom Sizes</Label>
                    {Array.from(selectedSizes).filter(s => s.startsWith("Custom")).map(name => {
                      const match = name.match(/Custom \((\d+)x(\d+)\)/);
                      return match ? (
                        <div key={name} className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 border-blue-300">
                          <span className="font-medium text-sm">{name}</span>
                          <div className="flex items-center gap-2">
                            <Badge>{match[1]} x {match[2]}</Badge>
                            <Button variant="ghost" size="sm" onClick={() => toggleSize(name)}><X className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Resize Mode</Label>
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
                </div>
                <div>
                  <Label htmlFor="resizerQuality" className="text-sm font-medium">Quality (1-100)</Label>
                  <Input id="resizerQuality" type="number" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="90" min="1" max="100" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Max File Size</Label>
                  <Select value={maxFileSize} onValueChange={setMaxFileSize}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No limit" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value || 'none'} value={option.value || 'none'}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {maxFileSize && maxFileSize !== 'none' && (
                    <p className="text-xs text-gray-500 mt-1">Quality auto-adjusts to stay under limit</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection summary */}
          {selectedSizes.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-blue-800">
                  {selectedSizes.size} size{selectedSizes.size !== 1 ? 's' : ''} selected
                  {uploadedImages.length > 1 && ` × ${uploadedImages.length} images = ${selectedSizes.size * uploadedImages.length} total operations`}
                </span>
                <div className="flex flex-wrap gap-1">
                  {Array.from(selectedSizes).slice(0, 5).map(name => (
                    <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                  ))}
                  {selectedSizes.size > 5 && <Badge variant="secondary" className="text-xs">+{selectedSizes.size - 5} more</Badge>}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            <Button onClick={handleResize} disabled={isProcessing || !hasImage || selectedSizes.size === 0} className="flex-1">
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resizing...</>
              ) : (
                <>Resize {uploadedImages.length > 1 ? `${uploadedImages.length} Images` : 'Image'} ({selectedSizes.size} size{selectedSizes.size !== 1 ? 's' : ''})</>
              )}
            </Button>
            {selectedSizes.size > 0 && (
              <Button variant="outline" onClick={clearSelection}>Clear Selection</Button>
            )}
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{progressText}</span>
                <span>{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
          )}

          {/* Results grouped by source image */}
          {groupedResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Results — {results.length} image{results.length !== 1 ? 's' : ''} across {groupedResults.length} source{groupedResults.length !== 1 ? 's' : ''}
                </h2>
                <Button onClick={downloadAll} variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Download All
                </Button>
              </div>

              {groupedResults.map((group) => (
                <Card key={group.sourceId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleCollapse(group.sourceId)}>
                        {collapsedSources.has(group.sourceId) ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        <CardTitle className="text-base truncate">{group.sourceName}</CardTitle>
                        <Badge variant="secondary">{group.items.length} size{group.items.length !== 1 ? 's' : ''}</Badge>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => downloadSourceImages(group.sourceId)}>
                        <Download className="h-3 w-3 mr-1" /> All
                      </Button>
                    </div>
                  </CardHeader>
                  {!collapsedSources.has(group.sourceId) && (
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.items.map((result, index) => (
                          <div key={index} className="border rounded-lg overflow-hidden">
                            <div className="aspect-video bg-gray-100 relative">
                              <img src={result.localUrl} alt={result.size} className="w-full h-full object-contain" />
                            </div>
                            <div className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm truncate">{result.size}</span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Badge variant="secondary" className="text-xs">{result.width}×{result.height}</Badge>
                                  {result.fileSize && <Badge variant="outline" className="text-xs">{formatFileSize(result.fileSize)}</Badge>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => copyToClipboard(result.url)}>
                                  {copiedUrl === result.url ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                  Copy URL
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => downloadImage(result)}>
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
