import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowRight, Image, Zap, Cloud } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
 
export default function AccessPortal() {
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
 
    setIsLoading(true);
    try {
      const response = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() })
      });
 
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("accessCode", accessCode.trim());
        localStorage.setItem("userId", data.userId.toString());
        
        toast({
          title: "Access Granted",
          description: `Welcome ${data.userName}! Redirecting to your media dashboard.`,
        });
        
        // Redirect based on user role
        setTimeout(() => {
          if (data.role === "admin") {
            setLocation("/dashboard");
          } else if (data.role === "developer") {
            setLocation("/dashboard");
          } else {
            setLocation("/dashboard");
          }
        }, 1500);
      } else {
        toast({
          title: "Invalid Access Code",
          description: "Please check your code and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to media services. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="relative mx-auto w-32 h-32 mb-6">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-full object-contain rounded-2xl shadow-2xl"
            >
              <source src="https://res.cloudinary.com/do26xsbby/video/upload/v1748190208/Discoverer_Logo_lkxor3.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
          </div>
          
          <p className="text-xl text-purple-200 font-medium mb-1">
            Media Management Hub
          </p>
          <p className="text-sm text-slate-400">
            Enter your access code to manage your media assets
          </p>
        </div>
 
        {/* Access Card */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Shield className="h-5 w-5 text-purple-400" />
              <span className="text-white font-semibold">Secure Access</span>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Access Code
                </label>
                <Input
                  type="text"
                  placeholder="Enter your unique code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-center text-lg font-mono tracking-wider h-12"
                  maxLength={15}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={!accessCode.trim() || isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Access Media Hub</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>
 
            {/* Features List */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center space-x-3 text-slate-300">
                <Image className="h-4 w-4 text-purple-400" />
                <span className="text-sm">Unlimited image & video hosting</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-300">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="text-sm">Real-time image transformations</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-300">
                <Cloud className="h-4 w-4 text-blue-400" />
                <span className="text-sm">Global CDN distribution</span>
              </div>
            </div>
 
            {/* Security Badge */}
            <div className="flex justify-center pt-2">
              <Badge variant="outline" className="border-green-400/30 text-green-400 bg-green-400/10">
                🔒 Secure Connection
              </Badge>
            </div>
          </CardContent>
        </Card>
 
        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-slate-400">
            Need help? Contact your administrator for your access code
          </p>
          <p className="text-xs text-slate-500">
            © 2025 City Discoverer Media Services.
            <br />
            Powered by Felix Studios - Professional Media Management
          </p>
        </div>
      </div>
    </div>
  );
}