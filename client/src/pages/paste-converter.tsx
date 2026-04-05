import { useState, useRef, useEffect } from "react";
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

  const handlePaste = async (e: React.ClipboardEvent | ClipboardEvent) => {
    console.log('handlePaste called', e);
    e.preventDefault();
    const items = e.clipboardData?.items;
    
    console.log('Clipboard items:', items);
    console.log('Items length:', items?.length);
    
    if (!items) {
      console.log('No clipboard items found');
      toast({
        title: "Paste Failed",
        description: "No clipboard data found",
        variant: "destructive",
      });
      return;
    }

    let imageFound = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`Item ${i}:`, item.type, item.kind);
      
      if (item.type.indexOf('image') !== -1) {
        console.log('Image item found:', item.type);
        imageFound = true;
        const file = item.getAsFile();
        console.log('File from item:', file);
        
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            console.log('Base64 loaded, length:', base64?.length);
            setPastedImage(base64);
            
            // Auto-generate filename if not provided
            if (!filename.trim()) {
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
              const extension = file.type.split('/')[1] || 'png';
              setFilename(`pasted-image-${timestamp}.${extension}`);
            }
            
            toast({
              title: "Image Pasted Successfully",
              description: `${file.type} image ready for conversion`,
            });
          };
          reader.onerror = (error) => {
            console.error('FileReader error:', error);
            toast({
              title: "Paste Failed",
              description: "Failed to read pasted image",
              variant: "destructive",
            });
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
    
    if (!imageFound) {
      console.log('No image found in clipboard items');
      toast({
        title: "No Image Found",
        description: "Please copy an image to your clipboard first",
        variant: "destructive",
      });
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
      // Convert base64 to blob for proper file upload
      const response = await fetch(pastedImage);
      const blob = await response.blob();
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('files', blob, filename.trim());
      
      // Use the regular upload endpoint
      const uploadResponse = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const data = await uploadResponse.json();
      
      // Transform the upload response to match expected format
      const file = data.files[0]; // Get the first uploaded file
      
      // Generate production domain URLs for Facebook compatibility
      const productionDomain = 'imagediscoverer.xyz';
      const productionUrl = `https://${productionDomain}/api/media/serve/${file.filename}`;
      
      const transformedResult = {
        success: true,
        embeddableUrl: productionUrl,
        directUrl: productionUrl,
        facebookUrl: productionUrl,
        file: file,
        variations: {
          thumbnail: `${file.embeddableUrl}?w=300&h=200&fit=crop&crop=center`,
          banner: `${file.embeddableUrl}?w=800&h=300&fit=crop&crop=center`,
          fullsize: `${file.embeddableUrl}?w=600&h=400&fit=contain`
        }
      };
      
      setResult(transformedResult);
      
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

  // Handle right-click paste operations
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      console.log('Global paste event triggered', e);
      console.log('Active element:', document.activeElement);
      console.log('Paste area ref:', pasteAreaRef.current);
      
      // Always handle paste events when on the paste converter page
      handlePaste(e);
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Enable right-click context menu on paste area
      if (pasteAreaRef.current?.contains(e.target as Node)) {
        console.log('Context menu on paste area');
      }
    };

    console.log('Setting up paste event listeners');
    document.addEventListener('paste', handleGlobalPaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      console.log('Cleaning up paste event listeners');
      document.removeEventListener('paste', handleGlobalPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Handle click to focus and enable paste
  const handlePasteAreaClick = () => {
    console.log('Paste area clicked');
    if (pasteAreaRef.current) {
      pasteAreaRef.current.focus();
      console.log('Paste area focused');
      
      // Try to read from clipboard directly on click
      if (navigator.clipboard && navigator.clipboard.read) {
        console.log('Attempting to read from clipboard...');
        navigator.clipboard.read().then(clipboardItems => {
          console.log('Clipboard items found:', clipboardItems);
          clipboardItems.forEach(clipboardItem => {
            clipboardItem.types.forEach(type => {
              console.log('Clipboard item type:', type);
              if (type.startsWith('image/')) {
                console.log('Found image in clipboard, processing...');
                clipboardItem.getType(type).then(blob => {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    setPastedImage(base64);
                    
                    if (!filename.trim()) {
                      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                      const extension = type.split('/')[1] || 'png';
                      setFilename(`pasted-image-${timestamp}.${extension}`);
                    }
                    
                    toast({
                      title: "Image Auto-Pasted",
                      description: "Image loaded from clipboard",
                    });
                  };
                  reader.readAsDataURL(blob);
                });
              }
            });
          });
        }).catch((error) => {
          console.log('Clipboard read failed:', error);
          // Clipboard API not available or permission denied
          // Fall back to standard paste handling
          toast({
            title: "Click to Paste",
            description: "Please use Ctrl+V (Cmd+V) to paste your image",
          });
        });
      } else {
        console.log('Clipboard API not available');
        toast({
          title: "Click to Paste",
          description: "Please use Ctrl+V (Cmd+V) to paste your image",
        });
      }
    }
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
                onClick={handlePasteAreaClick}
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
                        Right-click and select "Paste" or use Ctrl+V (Cmd+V on Mac)
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Click this area first to enable clipboard access
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
                <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700">Production URLs (imagediscoverer.xyz):</span>
                    <Badge variant="secondary">Ready to Use</Badge>
                  </div>
                  
                  {/* Facebook URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-blue-600 uppercase">Facebook URL (Direct Image)</label>
                    <Input
                      value={result.facebookUrl || result.directUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(result.facebookUrl || result.directUrl)}
                        className="flex-1"
                      >
                        {copiedUrl === (result.facebookUrl || result.directUrl) ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy Facebook URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.facebookUrl || result.directUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Direct image URL with proper content-type for Facebook posting</p>
                  </div>

                  {/* WordPress HTML */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 uppercase">WordPress HTML</label>
                    <Input
                      value={`<img src="${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain" alt="hosted-image" style="max-width: 100%; height: auto;" />`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`<img src="${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain" alt="hosted-image" style="max-width: 100%; height: auto;" />`)}
                        className="flex-1"
                      >
                        {copiedUrl === `<img src="${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain" alt="hosted-image" style="max-width: 100%; height: auto;" />` ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy HTML
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Paste in WordPress HTML editor for full image display</p>
                  </div>

                  {/* Direct URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 uppercase">Direct Image URL</label>
                    <Input
                      value={`${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain`)}
                        className="flex-1"
                      >
                        {copiedUrl === `${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain` ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`${result.directUrl || result.embeddableUrl}?w=600&h=400&fit=contain`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
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