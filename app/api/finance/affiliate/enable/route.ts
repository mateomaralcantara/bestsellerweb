import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function POST(request:Request){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({ok:false,error:"Debes iniciar sesión."},{status:401});
  const body=await request.json().catch(()=>null) as {code?:unknown}|null; const code=typeof body?.code==="string"?body.code.trim():"";
  const {data,error}=await supabase.rpc("finance_enable_affiliate",{p_code:code||null});
  if(error)return NextResponse.json({ok:false,error:error.message},{status:409});
  return NextResponse.json({ok:true,code:data});
}