import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { SwirlingBackground } from "@/components/SwirlingBackground";
import { FloatingHRIcons } from "@/components/FloatingHRIcons";
import { motion } from "framer-motion";

export function AuthPage() {
  const [_, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Send signed-in users straight to the dashboard.
        setLocation("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Depending on Supabase settings, sign up might require email confirmation
        setError("Check your email for the confirmation link if required, or try logging in.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side: Brand/Visual (Hidden on mobile) */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 bg-[#0F0A1A] overflow-hidden p-12">
        {/* Subtle Swirl specifically for the dark side */}
        <div className="absolute inset-0 z-0 opacity-50">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#78137C] rounded-full mix-blend-screen filter blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/40 rounded-full mix-blend-screen filter blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <FloatingHRIcons />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src="https://247labs.com/wp-content/uploads/2023/03/Group-10.png"
            alt="247 Labs Logo"
            className="h-10 object-contain brightness-0 invert"
          />
        </div>

        <div className="relative z-10">
          <h2 className="text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
            Streamline your<br />recruiting workflow.
          </h2>
          <p className="text-lg text-white/70 max-w-md font-medium">
            Manage requests, track postings, and automate your hiring pipeline with our AI-powered HR platform.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-white/40 font-medium">© 2026 247 Labs. All rights reserved.</p>
        </div>
      </div>

      {/* Right Side: Action Area */}
      <div className="relative flex items-center justify-center w-full lg:w-1/2 p-8 lg:p-12">
        {/* Subtle background for right side on mobile */}
        <div className="absolute inset-0 z-0 lg:hidden opacity-30">
          <SwirlingBackground />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md flex flex-col items-center"
        >
          {/* Logo visible only on mobile */}
          <div className="flex lg:hidden justify-center mb-10">
            <img
              src="https://247labs.com/wp-content/uploads/2023/03/Group-10.png"
              alt="247 Labs Logo"
              className="h-12 object-contain"
            />
          </div>

          <div className="bg-white lg:bg-transparent shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:shadow-none border border-gray-100 lg:border-none rounded-3xl p-8 lg:p-0 w-full flex flex-col items-stretch">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">
                {isLogin ? "Welcome back" : "Create an account"}
              </h1>
              <p className="text-base font-medium text-gray-500">
                {isLogin
                  ? "Enter your credentials to access your account"
                  : "Sign up to start automating your recruiting process"}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2 text-left">
                <Label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hello@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 bg-white/50 border-gray-200 focus:border-primary focus:ring-primary/20 rounded-2xl transition-all text-base"
                />
              </div>
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</Label>
                  {isLogin && (
                    <a href="#" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                      Forgot password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-14 bg-white/50 border-gray-200 focus:border-primary focus:ring-primary/20 rounded-2xl transition-all text-base tracking-widest"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="py-3 rounded-xl mt-4">
                  <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5 bg-primary hover:bg-primary/90 text-white mt-6" disabled={loading}>
                {loading ? "Please wait..." : isLogin ? "Sign in" : "Sign up"}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
