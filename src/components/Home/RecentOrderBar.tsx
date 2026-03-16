"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMyOrdersQuery } from "graphql/generated/graphql";

const statusConfig: Record<
  string,
  { label: string; color: string; dot: string; message: string }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-300",
    dot: "bg-yellow-400",
    message: "We're still processing your order.",
  },
  paid: {
    label: "Processing",
    color: "text-blue-300",
    dot: "bg-blue-400",
    message: "We're still processing your order.",
  },
  completed: {
    label: "Completed",
    color: "text-green-300",
    dot: "bg-green-400",
    message: "Your last order was completed.",
  },
  succeeded: {
    label: "Completed",
    color: "text-green-300",
    dot: "bg-green-400",
    message: "Your last order was completed.",
  },
  failed: {
    label: "Failed",
    color: "text-red-300",
    dot: "bg-red-400",
    message: "Your last order failed.",
  },
};

const RecentOrderBar = () => {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!window.localStorage.getItem("jwtToken"));
  }, []);

  const { data } = useMyOrdersQuery({
    variables: { limit: 1 },
    skip: !hasToken,
  });

  if (!hasToken) return null;

  const order = data?.myOrders?.[0];
  if (!order) return null;

  const status = order.status.toLowerCase();
  const config = statusConfig[status] ?? {
    label: order.status,
    color: "text-gray-300",
    dot: "bg-gray-400",
    message: "You have a recent order.",
  };

  return (
    <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {(status === "pending" || status === "paid") && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-75`}
            />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.dot}`}
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-white/80">
            {config.message}{" "}
            <span className={`font-medium ${config.color}`}>
              #{order.orderNumber}
            </span>
          </p>
          <p className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </p>
        </div>
      </div>
      <Link
        href="/orders"
        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
      >
        View Orders
      </Link>
    </div>
  );
};

export default RecentOrderBar;
