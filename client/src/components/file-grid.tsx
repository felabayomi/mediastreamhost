import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ConversionModal from "./conversion-modal";
import UrlBuilder from "./url-builder";
import { LinkIcon, DownloadIcon, TrashIcon, PlayIcon } from "lucide-react";
import { formatFileSize, getFileExtension, copyToClipboard } from "@/lib/file-utils";

interface MediaFile {
  id: number;
  filename: string;
  originalFilename: string;
  fileType: 'image' | 'video';
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  embeddableUrl: string;
  uploadedAt: string;
}

interface FileGridProps {
  files: MediaFile[];
}

export default function FileGrid({ files }: FileGridProps) {
  const [conversionModal, setConversionModal] = useState<{ isOpen: boolean; file: MediaFile | null }>({
    isOpen: false,
    file: null,
  });
  const [urlBuilderModal, setUrlBuilderModal] = useState<{ isOpen: boolean; file: MediaFile | null }>({
    isOpen: false,
    file: null,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "File deleted",
        description: "The file has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "There was an error deleting the file.",
        variant: "destructive",
      });
    },
  });

  const handleCopyUrl = async (url: string) => {
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

  const handleDownload = (file: MediaFile) => {
    const link = document.createElement('a');
    link.href = `/api/media/serve/${file.filename}`;
    link.download = file.originalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openConversionModal = (file: MediaFile) => {
    setConversionModal({ isOpen: true, file });
  };

  const closeConversionModal = () => {
    setConversionModal({ isOpen: false, file: null });
  };

  const openUrlBuilderModal = (file: MediaFile) => {
    setUrlBuilderModal({ isOpen: true, file });
  };

  const closeUrlBuilderModal = () => {
    setUrlBuilderModal({ isOpen: false, file: null });
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {files.map((file) => (
          <div key={file.id} className="group relative bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="aspect-video bg-gray-200 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              {file.fileType === 'image' ? (
                <img
                  src={`/api/media/serve/${file.filename}`}
                  alt={file.originalFilename}
                  className="w-full h-full object-cover rounded-lg"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                  <PlayIcon className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                {file.originalFilename}
              </h4>
              <Badge variant="secondary" className={`text-xs ${
                file.fileType === 'image' 
                  ? getFileExtension(file.originalFilename) === 'jpg' || getFileExtension(file.originalFilename) === 'jpeg'
                    ? 'bg-green-100 text-green-800'
                    : getFileExtension(file.originalFilename) === 'png'
                    ? 'bg-orange-100 text-orange-800'
                    : getFileExtension(file.originalFilename) === 'gif'
                    ? 'bg-pink-100 text-pink-800'
                    : 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {getFileExtension(file.originalFilename).toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>{formatFileSize(file.size)}</span>
              <span>
                {file.fileType === 'image' && file.width && file.height
                  ? `${file.width}x${file.height}`
                  : file.fileType === 'video' && file.duration
                  ? `${Math.floor(file.duration / 60)}:${(file.duration % 60).toString().padStart(2, '0')}`
                  : ''}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={() => openUrlBuilderModal(file)}
              >
                <LinkIcon className="h-3 w-3 mr-1" />
                Get URL
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="p-2"
                onClick={() => handleDownload(file)}
              >
                <DownloadIcon className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 text-red-600 hover:text-red-800"
                onClick={() => deleteMutation.mutate(file.id)}
                disabled={deleteMutation.isPending}
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConversionModal
        isOpen={conversionModal.isOpen}
        onClose={closeConversionModal}
        file={conversionModal.file}
      />

      <Dialog open={urlBuilderModal.isOpen} onOpenChange={closeUrlBuilderModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Embeddable URL</DialogTitle>
          </DialogHeader>
          {urlBuilderModal.file && (
            <UrlBuilder file={urlBuilderModal.file} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
