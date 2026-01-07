"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrderQuery } from "graphql/generated/graphql";
import { useWallet } from "@/contexts/WalletContext";
import Loader from "../common/Loader";
import moment from "moment";
import { FcPaid } from "react-icons/fc";
import { IoCloseCircle } from "react-icons/io5";
import { RiSecurePaymentFill } from "react-icons/ri";
import styles from "./Merchant.module.css";

const OrderReceipt = (props: { id: string; slug?: string }) => {
  const router = useRouter();
  const { isConnected, address } = useWallet();

  const { data, loading, error } = useOrderQuery({
    fetchPolicy: "network-only",
    pollInterval: 20000,
    variables: {
      id: props.id,
    },
    skip: !isConnected || !address,
  });

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected || !address) {
      console.log("Wallet not connected, redirecting to home...");
      router.push("/");
    }
  }, [isConnected, address, router]);

  if (!isConnected || !address) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (loading) return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Loader />
    </div>
  );

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-boxdark">
        <div className="w-full max-w-lg rounded-lg border border-stroke border-opacity-10 bg-white bg-opacity-5 p-10 shadow-xl">
          <div className="text-center">
            <IoCloseCircle
              className={`${styles.statusIcon} mx-auto mb-4 text-danger`}
              color="red"
            />
            <h1 className="mb-4 text-3xl font-bold">Error Loading Order</h1>
            <p className="mb-4 text-red-300">{error.message}</p>
            <button
              className="mt-6 rounded bg-primary px-8 py-3 text-white"
              onClick={() => router.push("/orders")}
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-boxdark">
        <div className="w-full max-w-lg rounded-lg border border-stroke border-opacity-10 bg-white bg-opacity-5 p-10 shadow-xl">
          <div className="text-center">
            <IoCloseCircle
              className={`${styles.statusIcon} mx-auto mb-4`}
              color="#ccc"
            />
            <h1 className="mb-4 text-3xl font-bold">Order Not Found</h1>
            <p className="mb-4 opacity-70">The order you're looking for doesn't exist</p>
            <button
              className="mt-6 rounded bg-primary px-8 py-3 text-white"
              onClick={() => router.push("/orders")}
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  const order = data.order;
  const isPending = order.status.toLowerCase() === "pending";
  const isPaid = order.status.toLowerCase() === "paid";
  const isCompleted = order.status.toLowerCase() === "completed";
  const isFailed = order.status.toLowerCase() === "failed";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-boxdark">
      <div className="w-full max-w-2xl rounded-lg border border-stroke border-opacity-10 bg-white bg-opacity-5 p-10 shadow-xl dark:border-strokedark">
        <div className="mb-10 text-center">
          <div className="mb-6 flex items-center justify-center">
            {isPending && (
              <RiSecurePaymentFill
                className={`${styles.statusIcon} text-success`}
                color="#ccc"
              />
            )}
            {isPaid && (
              <RiSecurePaymentFill
                className={`${styles.statusIcon} text-success`}
                color="lightgreen"
              />
            )}
            {isCompleted && (
              <FcPaid
                className={`${styles.statusIcon} text-success`}
                color="lightgreen"
              />
            )}
            {isFailed && (
              <IoCloseCircle
                className={`${styles.statusIcon} text-danger`}
                color="red"
              />
            )}
          </div>

          <h1 className="mb-2 text-3xl font-bold">
            {isPending && "Order Pending"}
            {isPaid && "Payment Confirmed"}
            {isCompleted && "Order Completed"}
            {isFailed && "Order Failed"}
          </h1>

          <p className="mb-6 opacity-80">
            {isPending && "Your order is awaiting confirmation"}
            {isPaid && "Your payment has been received and is being processed"}
            {isCompleted && "Your order has been successfully completed"}
            {isFailed && "Unfortunately, your order could not be completed"}
          </p>

          {/* Order Details */}
          <div className="mb-6 space-y-3 text-left">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <p className="font-bold">Order Number</p>
              <p className="font-mono">{order.orderNumber}</p>
            </div>

            <div className="flex justify-between border-b border-white/10 pb-2">
              <p className="font-bold">Status</p>
              <p className={`font-semibold uppercase ${
                isPending ? 'text-yellow-300' :
                isPaid ? 'text-blue-300' :
                isCompleted ? 'text-green-300' :
                'text-red-300'
              }`}>
                {order.status}
              </p>
            </div>

            {/* Show crypto amount if available, otherwise show fiat amount */}
            {(() => {
              const cryptoAmount = order.cryptoAmount
                ? order.cryptoAmount
                : order.cryptoTransaction?.amount;
              const cryptoCurrency = order.cryptoCurrency && order.cryptoCurrency !== "[FILTERED]"
                ? order.cryptoCurrency
                : order.cryptoTransaction?.token;

              if (cryptoAmount && cryptoCurrency) {
                return (
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <p className="font-bold">Amount</p>
                    <p className="font-mono text-xl font-bold text-green-400">
                      {typeof cryptoAmount === 'number' ? cryptoAmount.toFixed(6) : cryptoAmount} {cryptoCurrency}
                    </p>
                  </div>
                );
              }

              // Fallback to fiat amount
              return (
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <p className="font-bold">Amount</p>
                  <p className="text-xl font-bold">{order.amount} {order.currency}</p>
                </div>
              );
            })()}

            {order.cryptoTransaction && (
              <div className="rounded-lg bg-white/5 p-4 mt-4">
                <p className="mb-2 font-bold text-green-300">Crypto Payment Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <p className="opacity-70">Amount</p>
                    <p className="font-mono">
                      {typeof order.cryptoTransaction.amount === 'number'
                        ? order.cryptoTransaction.amount.toFixed(6)
                        : order.cryptoTransaction.amount} {order.cryptoTransaction.token}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="opacity-70">Network</p>
                    <p className="font-semibold">{order.cryptoTransaction.network}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="opacity-70">Transaction</p>
                    <a
                      href={`https://solscan.io/tx/${order.cryptoTransaction.transactionSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-300 hover:underline"
                    >
                      {order.cryptoTransaction.transactionSignature.slice(0, 8)}...
                      {order.cryptoTransaction.transactionSignature.slice(-8)}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <p className="opacity-70">Confirmations</p>
                    <p>{order.cryptoTransaction.confirmations || 0}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between border-b border-white/10 pb-2">
              <p className="font-bold">Order Type</p>
              <p className="capitalize">{order.orderType}</p>
            </div>

            <div className="flex justify-between border-b border-white/10 pb-2">
              <p className="font-bold">Date</p>
              <p>{moment(order.createdAt).format('MMMM D, YYYY h:mm A')}</p>
            </div>

            {/* Display User Input Data (Game Account Info) */}
            {order.metadata && Object.keys(order.metadata).length > 0 && (
              <div className="mt-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 p-4">
                <p className="mb-3 font-bold text-blue-300">Game Account Information</p>
                <div className="space-y-2">
                  {Object.entries(order.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-white/10 pb-2 last:border-0">
                      <p className="text-sm opacity-70">{key}</p>
                      <p className="text-sm font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              className="w-full rounded bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-3 font-semibold text-white transition hover:from-blue-600 hover:to-purple-600"
              onClick={() => router.push("/orders")}
            >
              View All Orders
            </button>
            <button
              className="w-full rounded bg-white/10 px-8 py-3 font-semibold transition hover:bg-white/20"
              onClick={() => router.push("/")}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;
