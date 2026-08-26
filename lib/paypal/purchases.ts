import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordBookSaleFinancials } from "@/lib/finance/record-sale";

const ACCESS_STATUSES=["paid","completed","approved","succeeded"];

export async function userAlreadyOwnsBook(input:{userId:string;bookId:string}){
  const {data,error}=await supabaseAdmin.from("book_purchases").select("id").eq("user_id",input.userId).eq("book_id",input.bookId).in("status",ACCESS_STATUSES).limit(1).maybeSingle();
  if(error)throw new Error(`Error verificando compra: ${error.message}`); return Boolean(data);
}

export async function grantBookPurchase(input:{userId:string;bookId:string;amount:string;currency:string;paypalOrderId:string;paypalCaptureId:string;affiliateUserId?:string|null}){
  const {data:existing,error:lookupError}=await supabaseAdmin.from("book_purchases").select("id").eq("user_id",input.userId).eq("book_id",input.bookId).limit(1).maybeSingle();
  if(lookupError)throw new Error(`Error buscando compra: ${lookupError.message}`);
  const payload={user_id:input.userId,book_id:input.bookId,status:"paid",payment_provider:"paypal",payment_reference:input.paypalCaptureId,provider_order_id:input.paypalOrderId,amount_paid:Number(input.amount),currency:input.currency,paid_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  let purchaseId:string;
  if(existing?.id){ const {error}=await supabaseAdmin.from("book_purchases").update(payload).eq("id",existing.id); if(error)throw new Error(`Error actualizando compra: ${error.message}`); purchaseId=existing.id as string; }
  else { const {data,error}=await supabaseAdmin.from("book_purchases").insert(payload).select("id").single(); if(error)throw new Error(`Error registrando compra: ${error.message}`); purchaseId=data.id as string; }
  await recordBookSaleFinancials({purchaseId,buyerUserId:input.userId,bookId:input.bookId,amount:input.amount,currency:input.currency,paypalOrderId:input.paypalOrderId,paypalCaptureId:input.paypalCaptureId,affiliateUserId:input.affiliateUserId??null});
  return purchaseId;
}