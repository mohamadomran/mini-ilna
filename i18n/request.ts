import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  const active = locale ?? routing.defaultLocale;
  return {
    locale: active,
    messages: (await import(`../messages/${active}.json`)).default,
  };
});
