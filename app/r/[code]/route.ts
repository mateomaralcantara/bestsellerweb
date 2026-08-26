import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeAffiliateCode, resolveAffiliateUserByCode } from "@/lib/finance/record-sale";
export const runtime="nodejs"; export const dynamic="force-dynamic";
type RouteContext={params:Promise<{code:string}>};
export async function GET(request:Request,context:RouteContext){
  const {code}=await context.params; const affiliateCode=normalizeAffiliateCode(code); const url=new URL(request.url); const bookSlug=(url.searchParams.get("book")??"").trim();
  const destination=bookSlug?new URL(`/catalog/${encodeURIComponent(bookSlug)}`,url.origin):new URL("/catalog",url.origin); const response=NextResponse.redirect(destination);
  if(!affiliateCode)return response; const affiliateUserId=await resolveAffiliateUserByCode(affiliateCode); if(!affiliateUserId)return response;
  const visitorKey=crypto.randomUUID();
  response.cookies.set("libroseller_affiliate",affiliateCode,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*24*30,path:"/"});
  response.cookies.set("libroseller_affiliate_visitor",visitorKey,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*24*30,path:"/"});
  await supabaseAdmin.from("finance_affiliate_clicks").insert({affiliate_id: affiliateUserId,visitor_key:visitorKey,book_slug:bookSlug||null,landing_path:url.pathname+url.search,referrer:request.headers.get("referer"),user_agent:request.headers.get("user-agent")});
  return response;
}