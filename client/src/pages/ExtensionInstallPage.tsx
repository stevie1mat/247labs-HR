import { Download, Chrome, FileCheck, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExtensionInstallPage() {
  return (
    <div className="flex-1 w-full flex flex-col items-center bg-gray-50 min-h-full">
      <div className="w-full max-w-4xl p-6 lg:p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
              Browser Extension
            </h1>
            <p className="text-gray-500 text-lg">
              Install the 247 Labs Job Poster extension to enable automated posting on job boards.
            </p>
          </div>
          <Button 
            className="h-12 px-6 shadow-md" 
            onClick={() => {
              window.location.href = "/extension.zip";
            }}
          >
            <Download className="w-5 h-5 mr-2" />
            Download Extension (.zip)
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Automated Posting</h3>
            <p className="text-sm text-gray-500">
              The extension securely controls your browser to automate tedious form-filling and job posting tasks.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Safe & Secure</h3>
            <p className="text-sm text-gray-500">
              Your credentials are never stored. The extension runs locally on your machine and uses your active session.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
              <Chrome className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Chrome Compatible</h3>
            <p className="text-sm text-gray-500">
              Works seamlessly on Google Chrome, Brave, Edge, and any other Chromium-based web browser.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-8 py-5 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Installation Instructions
            </h2>
          </div>
          <div className="p-8">
            <ol className="relative border-l border-gray-200 ml-3 space-y-10">
              <li className="pl-8">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4 ring-4 ring-white font-bold">
                  1
                </span>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Download and Extract</h3>
                <p className="text-gray-600 mb-3">
                  Click the download button above to get the <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">extension.zip</code> file. Once downloaded, extract (unzip) the folder to a safe location on your computer.
                </p>
              </li>
              <li className="pl-8">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4 ring-4 ring-white font-bold">
                  2
                </span>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Open Extensions Page</h3>
                <p className="text-gray-600 mb-3">
                  Open Google Chrome and navigate to <code className="bg-gray-100 px-2 py-0.5 rounded text-sm text-blue-600 select-all">chrome://extensions/</code> in your address bar.
                </p>
              </li>
              <li className="pl-8">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4 ring-4 ring-white font-bold">
                  3
                </span>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Enable Developer Mode</h3>
                <p className="text-gray-600 mb-3">
                  In the top-right corner of the Extensions page, toggle the switch to enable <strong>Developer mode</strong>.
                </p>
                <img 
                  src="https://developer.chrome.com/static/docs/extensions/mv3/getstarted/development-basics/image/developer-mode-toggle.png" 
                  alt="Developer Mode Toggle" 
                  className="rounded-lg border border-gray-200 w-full max-w-sm"
                />
              </li>
              <li className="pl-8">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4 ring-4 ring-white font-bold">
                  4
                </span>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Load the Extension</h3>
                <p className="text-gray-600 mb-3">
                  Click the <strong>Load unpacked</strong> button that appears in the top-left corner. Select the extracted <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">extension</code> folder from Step 1.
                </p>
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl text-sm font-medium">
                  🎉 You're done! The "247Labs Job Poster" extension is now installed and ready to automate job postings.
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
