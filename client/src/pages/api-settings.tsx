import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Check, Key, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";

const OPENAPI_SCHEMA = `{
  "openapi": "3.1.0",
  "info": {
    "title": "MediaHost Pro",
    "description": "Upload images to MediaHost Pro and get permanent hosted URLs.",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://mediahost.app"
    }
  ],
  "paths": {
    "/api/v1/upload": {
      "post": {
        "operationId": "uploadImage",
        "summary": "Upload an image to get a permanent URL",
        "description": "Upload an image via URL or base64. Returns a permanent hosted URL.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "image_url": {
                    "type": "string",
                    "description": "URL of the image to download and host (use this for DALL-E generated images)"
                  },
                  "image_base64": {
                    "type": "string",
                    "description": "Base64-encoded image data"
                  },
                  "filename": {
                    "type": "string",
                    "description": "Custom filename for the image"
                  },
                  "description": {
                    "type": "string",
                    "description": "Description of the image"
                  }
                },
                "required": []
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Image uploaded successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean" },
                    "file": {
                      "type": "object",
                      "properties": {
                        "id": { "type": "integer" },
                        "filename": { "type": "string" },
                        "url": { "type": "string", "description": "Permanent URL to access the image" },
                        "embeddable_url": { "type": "string" },
                        "width": { "type": "integer" },
                        "height": { "type": "integer" },
                        "size": { "type": "integer" }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Invalid or missing API key"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {},
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  },
  "security": [
    {
      "bearerAuth": []
    }
  ]
}`;

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
            Step 1: Get Your API Key
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
              <p className="text-sm text-gray-500">Keep this key secret. You'll paste it in ChatGPT's Authentication settings.</p>
              <Button variant="outline" onClick={generateKey} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Regenerate Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-600">Generate an API key first, then follow the steps below.</p>
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
          <CardTitle>Step 2: Copy the Schema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Copy this entire schema and paste it into your ChatGPT GPT's Actions editor.
            Go to <strong>Configure &gt; Actions &gt; Create new action</strong>, then replace everything in the Schema box with this:
          </p>
          <div className="relative">
            <Button
              variant="default"
              className="mb-2"
              onClick={() => copyToClipboard(OPENAPI_SCHEMA, "Schema")}
            >
              {copied === "Schema" ? <Check className="h-4 w-4 mr-2 text-white" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied === "Schema" ? "Copied!" : "Copy Full Schema"}
            </Button>
            <pre className="bg-gray-50 border rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
              {OPENAPI_SCHEMA}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Set Up Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">After pasting the schema:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Click the <strong>gear icon</strong> next to "Authentication" in the Actions section</li>
            <li>Choose <strong>"API Key"</strong> as the Authentication Type</li>
            <li>Set Auth Type to <strong>"Bearer"</strong></li>
            <li>Paste your <strong>API key</strong> from Step 1 above</li>
            <li>Click <strong>"Save"</strong></li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Add Privacy Policy URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">ChatGPT requires a privacy policy URL. Paste this in the Privacy Policy field:</p>
          <div className="flex items-center gap-2">
            <Input value="https://mediahost.app/privacy" readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard("https://mediahost.app/privacy", "Privacy URL")}
            >
              {copied === "Privacy URL" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 5: Add Instructions to Your GPT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">Add this to your GPT's Instructions so it knows to upload images:</p>
          <div className="relative">
            <Button
              variant="outline"
              className="mb-2"
              onClick={() => copyToClipboard(
                "IMPORTANT: Every time you generate an image using DALL-E, you MUST immediately use the uploadImage action to upload it. Pass the DALL-E temporary image URL in the image_url field. Then show the user the permanent URL from the response (the url field). Always do this automatically without asking.",
                "Instructions"
              )}
            >
              {copied === "Instructions" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied === "Instructions" ? "Copied!" : "Copy Instructions"}
            </Button>
            <div className="bg-gray-50 border rounded-lg p-4 text-sm whitespace-pre-wrap">
              IMPORTANT: Every time you generate an image using DALL-E, you MUST immediately use the uploadImage action to upload it. Pass the DALL-E temporary image URL in the image_url field. Then show the user the permanent URL from the response (the url field). Always do this automatically without asking.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
