import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileImageIcon } from "lucide-react";

interface MediaFile {
  id: number;
  filename: string;
  originalFilename: string;
  fileType: 'image' | 'video';
  mimeType: string;
}

interface ConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: MediaFile | null;
}

const imageFormats = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
];

const videoFormats = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'avi', label: 'AVI' },
];

export default function ConversionModal({ isOpen, onClose, file }: ConversionModalProps) {
  const [targetFormat, setTargetFormat] = useState("");
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const conversionMutation = useMutation({
    mutationFn: async (data: { mediaFileId: number; fromFormat: string; toFormat: string }) => {
      const response = await fetch('/api/conversions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaFileId: data.mediaFileId,
          fromFormat: data.fromFormat,
          toFormat: data.toFormat,
          status: 'pending',
          progress: 0,
        }),
      });

      if (!response.ok) throw new Error('Conversion failed');
      return response.json();
    },
    onSuccess: () => {
      setIsConverting(true);
      
      // Simulate conversion progress
      const progressInterval = setInterval(() => {
        setConversionProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsConverting(false);
            
            toast({
              title: "Conversion completed",
              description: "Your file has been converted successfully.",
            });
            
            queryClient.invalidateQueries({ queryKey: ['/api/conversions'] });
            
            setTimeout(() => {
              onClose();
              setConversionProgress(0);
              setTargetFormat("");
            }, 1000);
            
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 300);
    },
    onError: () => {
      setIsConverting(false);
      setConversionProgress(0);
      toast({
        title: "Conversion failed",
        description: "There was an error converting your file.",
        variant: "destructive",
      });
    },
  });

  const handleConvert = () => {
    if (!file || !targetFormat) return;
    
    const currentFormat = file.mimeType.split('/')[1];
    conversionMutation.mutate({
      mediaFileId: file.id,
      fromFormat: currentFormat,
      toFormat: targetFormat,
    });
  };

  const handleClose = () => {
    if (!isConverting) {
      onClose();
      setConversionProgress(0);
      setTargetFormat("");
    }
  };

  if (!file) return null;

  const availableFormats = file.fileType === 'image' ? imageFormats : videoFormats;
  const currentFormat = file.mimeType.split('/')[1].toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>File Conversion</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileImageIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{file.originalFilename}</p>
              <p className="text-sm text-gray-500">Convert from {currentFormat}</p>
            </div>
          </div>
          
          {!isConverting ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Convert to:</label>
                <Select value={targetFormat} onValueChange={setTargetFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose format" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFormats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleConvert}
                  disabled={!targetFormat || conversionMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {conversionMutation.isPending ? "Starting..." : "Convert"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Converting to {targetFormat.toUpperCase()} format...
                </p>
                
                <Progress value={conversionProgress} className="h-2" />
                
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{Math.round(conversionProgress)}% complete</span>
                  <span>
                    {conversionProgress < 100 
                      ? `~${Math.ceil((100 - conversionProgress) / 3)} seconds remaining`
                      : "Completed!"
                    }
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
