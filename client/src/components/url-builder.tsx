import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/file-utils";
import { CopyIcon, EyeIcon, CodeIcon } from "lucide-react";

interface MediaFile {
  id: number;
  filename: string;
  originalFilename: string;
  fileType: 'image' | 'video';
  mimeType: string;
  embeddableUrl: string;
}

interface UrlBuilderProps {
  file: MediaFile;
}

const fitOptions = [
  { value: 'crop', label: 'Crop' },
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Fill' },
];

const cropOptions = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'faces', label: 'Faces' },
];

const presetSizes = [
  { name: 'Square', w: 400, h: 400 },
  { name: 'Banner', w: 1200, h: 300 },
  { name: 'Card', w: 600, h: 400 },
  { name: 'Thumbnail', w: 150, h: 150 },
  { name: 'Social', w: 1080, h: 1080 },
];

export default function UrlBuilder({ file }: UrlBuilderProps) {
  const [width, setWidth] = useState('600');
  const [height, setHeight] = useState('300');
  const [fit, setFit] = useState('crop');
  const [crop, setCrop] = useState('center');
  const [quality, setQuality] = useState('80');
  const { toast } = useToast();

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (width) params.append('w', width);
    if (height) params.append('h', height);
    if (fit) params.append('fit', fit);
    if (crop && fit === 'crop') params.append('crop', crop);
    if (quality && file.fileType === 'image') params.append('q', quality);
    
    return `${file.embeddableUrl}?${params.toString()}`;
  };

  const handleCopy = async (url: string) => {
    const success = await copyToClipboard(url);
    if (success) {
      toast({
        title: "URL copied",
        description: "The embeddable URL has been copied to your clipboard.",
      });
    } else {
      toast({
        title: "Copy failed",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handlePresetSize = (preset: typeof presetSizes[0]) => {
    setWidth(preset.w.toString());
    setHeight(preset.h.toString());
  };

  const generatedUrl = buildUrl();
  const htmlEmbed = `<img src="${generatedUrl}" alt="${file.originalFilename}" />`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CodeIcon className="h-5 w-5" />
            <span>URL Builder</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preset Sizes */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {presetSizes.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetSize(preset)}
                  className="text-xs"
                >
                  {preset.name} ({preset.w}×{preset.h})
                </Button>
              ))}
            </div>
          </div>

          {/* Size Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="width" className="text-sm font-medium">Width (px)</Label>
              <Input
                id="width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="600"
                min="1"
                max="4000"
              />
            </div>
            <div>
              <Label htmlFor="height" className="text-sm font-medium">Height (px)</Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="300"
                min="1"
                max="4000"
              />
            </div>
          </div>

          {/* Fit and Crop Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Resize Mode</Label>
              <Select value={fit} onValueChange={setFit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fitOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fit === 'crop' && (
              <div>
                <Label className="text-sm font-medium">Crop Position</Label>
                <Select value={crop} onValueChange={setCrop}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cropOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Quality (Images only) */}
          {file.fileType === 'image' && (
            <div>
              <Label htmlFor="quality" className="text-sm font-medium">Quality (1-100)</Label>
              <Input
                id="quality"
                type="number"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                placeholder="80"
                min="1"
                max="100"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <EyeIcon className="h-5 w-5" />
            <span>Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center" style={{ minHeight: '200px' }}>
            {file.fileType === 'image' ? (
              <img
                src={generatedUrl}
                alt={file.originalFilename}
                className="max-w-full max-h-48 rounded border shadow-sm"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="text-gray-500 text-center">
                <p className="mb-2">Video Preview</p>
                <Badge variant="secondary">{file.originalFilename}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated URLs */}
      <Card>
        <CardHeader>
          <CardTitle>Generated URLs & Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Direct URL */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">Direct URL</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(generatedUrl)}
              >
                <CopyIcon className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="bg-gray-50 p-3 rounded border text-sm font-mono break-all">
              {generatedUrl}
            </div>
          </div>

          {/* HTML Embed */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">HTML Embed</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(htmlEmbed)}
              >
                <CopyIcon className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="bg-gray-50 p-3 rounded border text-sm font-mono break-all">
              {htmlEmbed}
            </div>
          </div>

          {/* Markdown */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">Markdown</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(`![${file.originalFilename}](${generatedUrl})`)}
              >
                <CopyIcon className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="bg-gray-50 p-3 rounded border text-sm font-mono break-all">
              ![{file.originalFilename}]({generatedUrl})
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}