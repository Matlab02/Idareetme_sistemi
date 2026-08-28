import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (value: number) => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const amount = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${sign}${amount} ₼`;
};
