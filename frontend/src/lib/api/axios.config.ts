import axios from "axios";
import { supabase } from "@/lib/supabase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

axiosInstance.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (accessToken) {
    config.headers = config.headers ?? {};
    const headers = config.headers as any;
    if (!headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});
