import { Download, Chrome, FileCheck, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExtensionInstallPage() {
  return (
    <div className="w-full space-y-6 pb-4">
      <section>
        <Card className="overflow-hidden rounded-xl border-white/70 bg-white/88 py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-200/70 px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
                  <Chrome className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-950">Browser Extension</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Install the 247 Labs Job Poster extension to enable automated posting.</p>
                </div>
              </div>
              <Button 
                className="h-10 px-6 rounded-xl shadow-md bg-primary hover:bg-primary/90 text-white font-medium" 
                onClick={() => {
                  window.location.href = "/extension.zip";
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download (.zip)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-6">


            <div className="rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.03)] overflow-hidden">
              <div className="border-b border-slate-200/70 px-6 py-4 bg-slate-50/50">
                <h2 className="text-lg font-semibold text-slate-950 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  Installation Instructions
                </h2>
              </div>
              <div className="p-6">
                <ol className="relative border-l border-slate-200 ml-4 space-y-10">
                  <li className="pl-10">
                    <span className="absolute flex items-center justify-center w-10 h-10 bg-slate-950 text-white rounded-xl -left-5 ring-4 ring-white font-bold text-base shadow-sm">
                      1
                    </span>
                    <h3 className="font-semibold text-slate-950 text-base mb-2">Download and Extract</h3>
                    <p className="text-slate-600 text-base leading-relaxed mb-4">
                      Click the download button above to get the <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700 font-medium border border-slate-200">extension.zip</code> file. Once downloaded, extract (unzip) the folder to a safe location on your computer.
                    </p>
                  </li>
                  <li className="pl-10">
                    <span className="absolute flex items-center justify-center w-10 h-10 bg-slate-950 text-white rounded-xl -left-5 ring-4 ring-white font-bold text-base shadow-sm">
                      2
                    </span>
                    <h3 className="font-semibold text-slate-950 text-base mb-2">Open Extensions Page</h3>
                    <p className="text-slate-600 text-base leading-relaxed mb-4">
                      Open Google Chrome and navigate to <code className="bg-sky-50 px-2 py-1 rounded text-sm text-sky-700 font-medium border border-sky-100 select-all">chrome://extensions/</code> in your address bar.
                    </p>
                  </li>
                  <li className="pl-10">
                    <span className="absolute flex items-center justify-center w-10 h-10 bg-slate-950 text-white rounded-xl -left-5 ring-4 ring-white font-bold text-base shadow-sm">
                      3
                    </span>
                    <h3 className="font-semibold text-slate-950 text-base mb-2">Enable Developer Mode</h3>
                    <p className="text-slate-600 text-base leading-relaxed mb-4">
                      In the top-right corner of the Extensions page, toggle the switch to enable <strong className="text-slate-700 font-semibold">Developer mode</strong>.
                    </p>
                  </li>
                  <li className="pl-10">
                    <span className="absolute flex items-center justify-center w-10 h-10 bg-slate-950 text-white rounded-xl -left-5 ring-4 ring-white font-bold text-base shadow-sm">
                      4
                    </span>
                    <h3 className="font-semibold text-slate-950 text-base mb-2">Load the Extension</h3>
                    <p className="text-slate-600 text-base leading-relaxed mb-4">
                      Click the <strong className="text-slate-700 font-semibold">Load unpacked</strong> button that appears in the top-left corner. Select the extracted <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700 font-medium border border-slate-200">extension</code> folder from Step 1.
                    </p>
                    <div className="bg-emerald-50/50 border border-emerald-100 text-emerald-800 p-4 rounded-xl text-base font-medium flex items-start gap-3 shadow-sm mt-6">
                      <span className="text-xl leading-none">🎉</span>
                      <p className="leading-relaxed">You're done! The "247Labs Job Poster" extension is now installed and ready to automate job postings.</p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
