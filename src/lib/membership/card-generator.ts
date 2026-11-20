import QRCode from "qrcode";
import { appOrigin } from "@/lib/utils";

export async function cardLink(token: string) {
  return `${await appOrigin()}/verify/${token}`;
}

export async function cardQr(token: string) {
  const url = await cardLink(token);
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: "#123B78", light: "#FFFFFF" } });
  return { url, dataUrl };
}
