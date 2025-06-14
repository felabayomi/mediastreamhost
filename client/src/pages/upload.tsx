import Header from "@/components/header";
import FileUpload from "@/components/file-upload";
import { Card, CardContent } from "@/components/ui/card";

export default function Upload() {
  return (
    <>
      <Header 
        title="Upload Files"
        subtitle="Upload and manage your media files"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border border-gray-200">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Media</h2>
                <p className="text-gray-600">
                  Support for JPEG, PNG, GIF, WebP images and MP4, AVI, MOV videos
                </p>
              </div>
              
              <FileUpload />
              
              <div className="mt-8 text-sm text-gray-500">
                <h3 className="font-medium mb-2">Supported Formats:</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">Images:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>JPEG (.jpg, .jpeg)</li>
                      <li>PNG (.png)</li>
                      <li>GIF (.gif)</li>
                      <li>WebP (.webp)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Videos:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>MP4 (.mp4)</li>
                      <li>AVI (.avi)</li>
                      <li>MOV (.mov)</li>
                    </ul>
                  </div>
                </div>
                <p className="mt-4 text-xs">
                  Maximum file size: 100MB per file
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
