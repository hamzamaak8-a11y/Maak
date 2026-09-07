export * from "./admin";
import { supabase } from "./supabaseClient";
import type { AdminApplication, AdminBooking, AdminCustomer, AdminDocument } from "./admin";

export type AdminMarketplaceListing = { id:number; name:string; job:string; city:string; distance:number|null; rating:number|null; reviews:number|null; image:string|null; available:boolean|null; provider_profile_id:string|null; published_at:string|null };
export type AdminAudit = { id:string; admin_id:string; action:string; target_type:string; target_id:string|null; metadata:Record<string,unknown>; created_at:string };
export type AdminAccount = { id:string; full_name:string|null; phone:string|null; city:string|null; account_status:"active"|"suspended"; created_at:string };
function fail(e:unknown,fallback:string):Error{return new Error(e&&typeof e==="object"&&"message" in e&&typeof (e as {message?:unknown}).message==="string"?(e as {message:string}).message:fallback)}
export async function listMarketplace():Promise<{rows:AdminMarketplaceListing[];total:number}>{const {data,error,count}=await supabase.from("providers").select("id,name,job,city,distance,rating,reviews,image,available,provider_profile_id,published_at",{count:"exact"}).eq("listing_kind","real").not("published_at","is",null).not("provider_profile_id","is",null).order("published_at",{ascending:false}).limit(50);if(error)throw fail(error,"adm.loadMarketplaceFail");return{rows:(data??[]) as AdminMarketplaceListing[],total:count??0}}
export async function listAudit():Promise<AdminAudit[]>{const {data,error}=await supabase.from("admin_audit_log").select("id,admin_id,action,target_type,target_id,metadata,created_at").order("created_at",{ascending:false}).limit(40);if(error)throw fail(error,"adm.loadAuditFail");return(data??[]) as AdminAudit[]}
export async function listAdminAccounts():Promise<AdminAccount[]>{const {data,error}=await supabase.from("profiles").select("id,full_name,phone,city,account_status,created_at").eq("role","admin").order("created_at",{ascending:true});if(error)throw fail(error,"adm.loadAdminsFail");return(data??[]) as AdminAccount[]}
export type { AdminApplication, AdminBooking, AdminCustomer, AdminDocument };
