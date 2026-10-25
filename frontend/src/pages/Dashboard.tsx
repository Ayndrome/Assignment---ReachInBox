
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Search, Filter, RefreshCw, Mail, Send } from "lucide-react";
import client from "../api/client";

interface Delivery {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
}

type DeliverySection = "ALL" | "SCHEDULED" | "SENT";

export const Dashboard: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeSection, setActiveSection] = useState<DeliverySection>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await client.get("/deliveries/search", {
        params: {
          q: searchQuery,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });

      const results = response.data?.results;

      if (!Array.isArray(results)) {
        throw new Error("Unexpected response from the deliveries API.");
      }

      setDeliveries(results);
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
      setError("Unable to load deliveries. Please try again.");
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    void fetchDeliveries();
  }, [fetchDeliveries, refreshKey]);

  const scheduledDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "SCHEDULED"),
    [deliveries],
  );

  const sentDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          delivery.status === "SENT" || delivery.status === "FAILED",
      ),
    [deliveries],
  );

  const visibleDeliveries = useMemo(() => {
    if (activeSection === "SCHEDULED") return scheduledDeliveries;
    if (activeSection === "SENT") return sentDeliveries;
    return deliveries;
  }, [activeSection, deliveries, scheduledDeliveries, sentDeliveries]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";

    const date = parseISO(value);
    return isValid(date) ? format(date, "MMM d, yyyy · h:mm a") : "—";
  };

  const statusClass = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-green-100 text-green-800";
      case "SCHEDULED":
        return "bg-blue-100 text-blue-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "PROCESSING":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const renderTable = (
    rows: Delivery[],
    section: "SCHEDULED" | "SENT",
  ) => {
    const emptyMessage =
      section === "SCHEDULED"
        ? "No scheduled emails found."
        : "No sent or failed emails found.";

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Subject
              </th>
              {section === "SCHEDULED" ? (
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Scheduled time
                </th>
              ) : (
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sent time
                </th>
              )}
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              Array.from({ length: 4 }, (_, index) => (
                <tr key={index} className="animate-pulse">
                  {Array.from({ length: 4 }, (_, cell) => (
                    <td key={cell} className="px-5 py-4">
                      <div className="h-4 w-28 rounded bg-gray-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((delivery) => (
                <tr
                  key={delivery.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-900">
                    {delivery.recipient_email}
                  </td>
                  <td className="max-w-xs truncate px-5 py-4 text-sm text-gray-600">
                    {delivery.subject || "(No subject)"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                    {section === "SCHEDULED"
                      ? formatDate(delivery.scheduled_at)
                      : formatDate(delivery.sent_at)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(delivery.status)}`}
                    >
                      {delivery.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Email Deliveries
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Search and monitor your scheduled, sent, and failed emails.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search email address or subject..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-8 outline-none focus:border-indigo-500 sm:w-44"
          >
            <option value="">All statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PROCESSING">Processing</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-700"
        >
          Search
        </button>

        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
          aria-label="Refresh deliveries"
          title="Refresh"
          className="flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total results"
          value={deliveries.length}
          loading={loading}
        />
        <SummaryCard
          label="Scheduled"
          value={scheduledDeliveries.length}
          loading={loading}
        />
        <SummaryCard
          label="Sent / Failed"
          value={sentDeliveries.length}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", "All deliveries"],
            ["SCHEDULED", "Scheduled emails"],
            ["SENT", "Sent emails"],
          ] as const
        ).map(([section, label]) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeSection === section
                ? "bg-indigo-600 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(activeSection === "ALL" || activeSection === "SCHEDULED") && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="rounded-lg bg-blue-50 p-2">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                Scheduled Emails
              </h2>
              <p className="text-sm text-gray-500">
                {loading ? "Loading…" : `${scheduledDeliveries.length} emails`}
              </p>
            </div>
          </div>
          {renderTable(scheduledDeliveries, "SCHEDULED")}
        </section>
      )}

      {(activeSection === "ALL" || activeSection === "SENT") && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="rounded-lg bg-green-50 p-2">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Sent Emails</h2>
              <p className="text-sm text-gray-500">
                {loading ? "Loading…" : `${sentDeliveries.length} emails`}
              </p>
            </div>
          </div>
          {renderTable(sentDeliveries, "SENT")}
        </section>
      )}

      {activeSection !== "ALL" && !loading && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              {activeSection === "SCHEDULED"
                ? "Scheduled Emails"
                : "Sent Emails"}
            </h2>
          </div>
          {renderTable(visibleDeliveries, activeSection)}
        </section>
      )}
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value: number;
  loading: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  loading,
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900">
      {loading ? "—" : value.toLocaleString()}
    </p>
  </div>
);
