import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (value: number) => new Intl.NumberFormat("az-AZ", { style: "currency", currency: "AZN", maximumFractionDigits: 0 }).format(value);
