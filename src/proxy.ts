import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const privateResponse = (result: NextResponse) => {
    result.headers.set("Cache-Control", "private, no-store, max-age=0");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  };
  if (!config) return privateResponse(response);
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  const { data, error } = await client.auth.getUser();
  const publicPage = ["/login", "/acesso-negado"].includes(
    request.nextUrl.pathname,
  );
  // Server Actions check authorization themselves and can retain unsaved drafts on expiry.
  if (
    (!data.user || error || data.user.is_anonymous) &&
    !publicPage &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return privateResponse(redirect);
  }
  return privateResponse(response);
}

export const config = {
  matcher: [
    "/",
    "/familias/:path*",
    "/novo",
    "/relatorios",
    "/login",
    "/acesso-negado",
  ],
};
