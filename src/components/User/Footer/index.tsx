"use client";
import { useStore } from "@/contexts/StoreContext";

import Link from "next/link";
import {
  FaDiscord,
  FaFacebook,
  FaInstagram,
  FaTelegram,
  FaTiktok,
  FaTwitch,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import styles from "./Footer.module.css";

const Footer = ({ slug }: { slug?: string }) => {
  const { store } = useStore();

  return (
    <footer
      className="mt-24 pb-32 pt-10 md:pb-24"
      style={{ backgroundColor: store?.footerColor ?? undefined }}
    >
      <div className="container mx-auto">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            {!!store?.iconUrl && (
              <img src={store.iconUrl} className={styles.logo} />
            )}
            <p className="opacity-6 text-sm md:pr-12">
              {store?.description
                ? store.description
                : `${process.env.NEXT_PUBLIC_STORE_NAME} is your go-to platform for quick, secure, and affordable in-game purchases. ${process.env.NEXT_PUBLIC_STORE_NAME} makes it simple to reload game
            credits anytime, anyplace, for popular games as well as your personal favorites.Enjoy exclusive deals, lifetime referral rewards, and instant top-up delivery — all in one place!`}
            </p>
          </div>
          <div className="text-sm md:pt-12">
            <h4 className="mb-2 font-bold">CATEGORIES</h4>
            <Link
              href={!!slug ? `/${slug}?category_id=5` : "/?category_id=5"}
              className="mb-1 block hover:underline"
            >
              <p className="opacity-70">Mobile Games</p>
            </Link>
            <Link
              href={!!slug ? `/${slug}?category_id=4` : "/?category_id=4"}
              className="mb-1 block hover:underline"
            >
              <p className="opacity-70">PC Games</p>
            </Link>
            <Link
              href={!!slug ? `/${slug}?category_id=6` : "/?category_id=6"}
              className="mb-1 block hover:underline"
            >
              <p className="opacity-70">Console Games</p>
            </Link>
          </div>
          <div className="text-sm md:pt-12">
            <h4 className="mb-2 font-bold">INFO</h4>
            <Link href="/terms" className="mb-1 block hover:underline">
              <p className="opacity-70">Terms & Conditions</p>
            </Link>
            <Link href="/refund-policy" className="mb-1 block hover:underline">
              <p className="opacity-70">Refund Policy</p>
            </Link>
            <Link href="/policy" className="mb-1 block hover:underline">
              <p className="opacity-70">Data Protection</p>
            </Link>
            <Link href="/anti-bribery" className="mb-1 block hover:underline">
              <p className="opacity-70">Anti-Bribery & Corruption</p>
            </Link>
          </div>
          <div className="text-sm md:pt-12">
            <h4 className="mb-2 font-bold">CONTACT US</h4>
            {!!store?.fbUrl && (
              <Link
                href={store.fbUrl}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaFacebook />
                <p>Facebook</p>
              </Link>
            )}
            {!!store?.tiktokUrl && (
              <Link
                href={store.tiktokUrl}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaTiktok />
                <p>Tiktok</p>
              </Link>
            )}
            {!!store?.instagramUrl && (
              <Link
                href={store.instagramUrl}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaInstagram />
                <p>Instagram</p>
              </Link>
            )}
            {!!store?.whatsappNumber && (
              <Link
                href={`https://wa.me/6${store.whatsappNumber}`}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaWhatsapp />
                <p>Whatsapp</p>
              </Link>
            )}
            {!!store?.telegramNumber && (
              <Link
                href={`https://wa.me/6${store.telegramNumber}`}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaTelegram />
                <p>Telegram</p>
              </Link>
            )}
            {!!store?.youtubeUrl && (
              <Link
                href={store.youtubeUrl}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaYoutube />
                <p>Youtube</p>
              </Link>
            )}
            {!!store?.discordUrl && (
              <Link
                href={store.discordUrl}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaDiscord />
                <p>Discord</p>
              </Link>
            )}
            {!!store?.twitchUrl && (
              <Link
                href={store.twitchUrl}
                target="_blank"
                className="mb-1 block flex items-center gap-2 opacity-70 hover:underline"
              >
                <FaTwitch />
                <p>Twitch</p>
              </Link>
            )}
          </div>
        </div>
        <div className="mt-10 border-t pt-3 text-xs opacity-50">
          <p>
            ©️ 2025 {process.env.NEXT_PUBLIC_STORE_NAME}. All Rights Reserved.{" "}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
