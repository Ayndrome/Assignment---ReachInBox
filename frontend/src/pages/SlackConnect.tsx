import React, { useEffect, useState } from "react";
import client from "../api/client";
import { MessageSquare, CheckCircle, AlertCircle, RefreshCw, LogOut } from "lucide-react";

export const SlackConnect: React.FC = () => {
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await client.get("/slack/status");
      setConnection(response.data.connection);
    } catch (error) {
      console.error("Failed to fetch Slack status", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = () => {
    window.location.href = "http://localhost:4000/api/v1/slack/connect";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Slack Integration</h2>
            <p className="text-sm text-gray-500">Get notified when you reach your sending limits.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
          </div>
        ) : connection ? (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Connected to Slack</p>
                <p className="text-sm text-green-700">Team: {connection.team_name}</p>
                <p className="text-xs text-green-600 mt-1">Connected since {new Date(connection.connected_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button
                className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center transition-colors"
                onClick={() => {/* Disconnect logic */}}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect Slack
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-center py-4">
            <p className="text-gray-600 max-w-sm mx-auto">
              Connect your Slack workspace to receive real-time alerts when your email campaigns are rate-limited.
            </p>
            <button
              onClick={handleConnect}
              className="inline-flex items-center px-6 py-3 bg-[#4A154B] text-white font-semibold rounded-lg hover:opacity-90 transition-all shadow-md"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Add to Slack
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-900">Why connect Slack?</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc pl-4">
              <li>Instant alerts for hourly quota exhaustion.</li>
              <li>Estimated retry time notifications.</li>
              <li>Identify sending bottlenecks across multiple senders.</li>
              <li>Ensure your campaigns keep running smoothly.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
