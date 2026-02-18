import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Check, Key, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

export default function ApiSettings() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const { toast } = useToast();

  const accessCode = localStorage.getItem("accessCode") || "";

  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
    try {
      const res = await fetch('/api/api-key', {
        headers: { 'x-access-code': accessCode }
      });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.apiKey);
      }
    } catch (e) {}
  };

  const generateKey = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode })
      });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.apiKey);
        toast({ title: "API Key Generated", description: "Your new API key is ready to use." });
      } else {
        toast({ title: "Error", description: "Failed to generate API key", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate API key", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const openapiUrl = "https://mediahost.app/api/openapi.json";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Header
        title="ChatGPT Integration"
        subtitle="Connect your custom ChatGPT GPT to automatically upload and host images"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={apiKey} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(apiKey, "API Key")}
                >
                  {copied === "API Key" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-gray-500">Keep this key secret. Anyone with it can upload images to your account.</p>
              <Button variant="outline" onClick={generateKey} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Regenerate Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-600">No API key generated yet. Generate one to connect your ChatGPT GPT.</p>
              <Button onClick={generateKey} disabled={isLoading}>
                <Key className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Generate API Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions for ChatGPT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">Step 1: Open your GPT settings</h3>
            <p className="text-sm text-gray-600">Go to your custom GPT in ChatGPT and click "Configure", then scroll down to "Actions".</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Step 2: Import the schema</h3>
            <p className="text-sm text-gray-600">Click "Import from URL" and paste this URL:</p>
            <div className="flex items-center gap-2">
              <Input value={openapiUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(openapiUrl, "Schema URL")}
              >
                {copied === "Schema URL" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Step 3: Set up authentication</h3>
            <p className="text-sm text-gray-600">
              In the Actions settings, click the gear icon next to Authentication. Choose "API Key", 
              set Auth Type to "Bearer", and paste your API key from above.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Step 4: Add instructions to your GPT</h3>
            <p className="text-sm text-gray-600">Add something like this to your GPT's instructions:</p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap border">
{`When you generate an image, always upload it to MediaHost Pro using the uploadImage action with the image URL. Then share the permanent hosted URL with the user.`}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">How it works</h3>
            <p className="text-sm text-gray-600">
              When your ChatGPT GPT generates an image (with DALL-E), it gets a temporary URL that expires. 
              By adding this action, your GPT will automatically upload the image to MediaHost Pro and give 
              you a permanent URL that never expires.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
