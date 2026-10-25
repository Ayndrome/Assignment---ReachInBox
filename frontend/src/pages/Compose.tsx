import React, { useState } from "react";
import client from "../api/client";
import { Send, Upload, X, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export const Compose: React.FC = () => {
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startAt, setStartAt] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingSenders, setFetchingSenders] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchSenders = async () => {
      try {
        const res = await client.get("/senders");
        setSenders(res.data.senders);
        if (res.data.senders.length > 0) {
          setSelectedSenderId(res.data.senders[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch senders", err);
      } finally {
        setFetchingSenders(false);
      }
    };
    fetchSenders();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const emails = text
        .split(/[\n,]/)
        .map(e => e.trim())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      
      const uniqueEmails = Array.from(new Set(emails));
      setRecipients(uniqueEmails);
    };
    reader.readAsText(file);
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formattedStartAt = startAt.length === 16 ? `${startAt}:00` : startAt;

      console.log(startAt);
    try {
      await client.post("/campaigns", {
        subject,
        bodyText,
        recipients,
        startAt: formattedStartAt, 
        delaySeconds,
        hourlyLimit,
        senderId: selectedSenderId,
      });

      setSuccess(true);
      setSubject("");
      setBodyText("");
      setRecipients([]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to schedule campaign");
    } finally {
      setLoading(false);
    }
  };


  if (success) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Scheduled!</h2>
        <p className="text-gray-500 mb-6">Your emails will be delivered according to the schedule.</p>
        <button
          onClick={() => setSuccess(false)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Compose Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From (Sender)</label>
            {fetchingSenders ? (
              <div className="h-10 bg-gray-100 animate-pulse rounded-lg"></div>
            ) : senders.length > 0 ? (
              <select
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
              >
                {senders.map(s => (
                  <option key={s.id} value={s.id}>{s.display_name || s.email} ({s.email})</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-red-500 py-2">
                No active senders found. Please add a sender first.
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body (Text)</label>
          <textarea
            required
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900">Recipients</h3>
          
          <div className="flex items-center gap-4">
            <label className="flex-1 cursor-pointer flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-gray-500 hover:text-indigo-600">
              <Upload className="h-5 w-5 mr-2" />
              <span>Upload CSV/Text</span>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          {recipients.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">{recipients.length} recipients found</span>
                <button type="button" onClick={() => setRecipients([])} className="text-red-500 hover:text-red-700 flex items-center">
                  <X className="h-4 w-4 mr-1" /> Clear
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 text-xs text-gray-600 space-y-1 bg-gray-50">
                {recipients.map((email, i) => (
                  <div key={i}>{email}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900">Schedule Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start At (Local Time)</label>
              <input
                type="datetime-local"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delay (sec)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Limit</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start text-red-700">
          <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || recipients.length === 0}
          className="flex items-center px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {loading ? (
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          Schedule Campaign
        </button>
      </div>
    </form>
  );
};
