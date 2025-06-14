import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CloudUploadIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  id: string;
}

export default function FileUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      setUploadFiles(prev => 
        prev.map(file => ({ ...file, status: "completed" as const, progress: 100 }))
      );
      
      toast({
        title: "Upload successful",
        description: "Your files have been uploaded successfully.",
      });

      // Clear files after a delay
      setTimeout(() => {
        setUploadFiles([]);
      }, 2000);
    },
    onError: () => {
      setUploadFiles(prev => 
        prev.map(file => ({ ...file, status: "error" as const }))
      );
      
      toast({
        title: "Upload failed",
        description: "There was an error uploading your files.",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newUploadFiles = acceptedFiles.map(file => ({
        file,
        progress: 0,
        status: "pending" as const,
        id: Math.random().toString(36).substr(2, 9),
      }));

      setUploadFiles(newUploadFiles);
      
      // Simulate upload progress
      newUploadFiles.forEach((uploadFile, index) => {
        setTimeout(() => {
          setUploadFiles(prev => 
            prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, status: "uploading" as const }
                : f
            )
          );

          const progressInterval = setInterval(() => {
            setUploadFiles(prev => 
              prev.map(f => {
                if (f.id === uploadFile.id && f.progress < 90) {
                  return { ...f, progress: Math.min(90, f.progress + Math.random() * 20) };
                }
                return f;
              })
            );
          }, 200);

          setTimeout(() => {
            clearInterval(progressInterval);
          }, 1000);
        }, index * 100);
      });

      uploadMutation.mutate(acceptedFiles);
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`upload-area rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "drag-over" : ""
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <CloudUploadIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h4 className="text-lg font-medium text-gray-900 mb-2">
          {isDragActive ? "Drop files here" : "Drop files here or click to upload"}
        </h4>
        <p className="text-gray-500 mb-4">Support for JPEG, PNG, GIF, WebP, MP4, AVI, MOV</p>
        <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white">
          Choose Files
        </Button>
      </div>

      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          {uploadFiles.map((uploadFile) => (
            <div key={uploadFile.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    uploadFile.status === "completed" ? "bg-green-100" :
                    uploadFile.status === "error" ? "bg-red-100" : "bg-blue-100"
                  }`}>
                    {uploadFile.status === "completed" ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    ) : uploadFile.status === "error" ? (
                      <XCircleIcon className="h-4 w-4 text-red-600" />
                    ) : (
                      <CloudUploadIcon className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{uploadFile.file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(uploadFile.file.size)}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {uploadFile.status === "completed" ? "Complete" :
                   uploadFile.status === "error" ? "Failed" :
                   `${Math.round(uploadFile.progress)}%`}
                </div>
              </div>
              {uploadFile.status === "uploading" && (
                <Progress value={uploadFile.progress} className="h-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
