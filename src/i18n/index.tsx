import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar, catLabels as catAr, svcLabels as svcAr, docLabels as docAr } from "./ar";
import { fr, catLabels as catFr, svcLabels as svcFr, docLabels as docFr } from "./fr";
import { adminAr, adminFr } from "./admin";
import { bookingErrorAr, bookingErrorFr } from "./booking-errors";

export type Lang = "ar" | "fr";
export type Dir = "rtl" | "ltr";
const STORAGE_KEY = "maak:lang:v2";
const DICTS: Record<Lang, Record<string,string>> = { ar: { ...ar, ...adminAr, ...bookingErrorAr }, fr: { ...fr, ...adminFr, ...bookingErrorFr } };
const CAT: Record<Lang, Record<string,string>> = { ar: catAr, fr: catFr };
const SVC: Record<Lang, Record<string,string>> = { ar: svcAr, fr: svcFr };
const DOC: Record<Lang, Record<string,string>> = { ar: docAr, fr: docFr };
export const LANGS: Lang[] = ["fr","ar"];
export const dirOf=(lang:Lang):Dir=>lang==="ar"?"rtl":"ltr";
function readInitialLang():Lang{try{const stored=localStorage.getItem(STORAGE_KEY);if(stored==="fr"||stored==="ar")return stored;}catch{}return"fr";}
interface LanguageContextValue{lang:Lang;dir:Dir;isRTL:boolean;setLang:(lang:Lang)=>void;toggleLang:()=>void;t:(key:string,vars?:Record<string,string|number>)=>string;catLabel:(value:string)=>string;svcLabel:(value:string)=>string;docLabel:(value:string)=>string;}
const LanguageContext=createContext<LanguageContextValue|null>(null);
export function LanguageProvider({children}:{children:ReactNode}){const[lang,setLangState]=useState<Lang>(readInitialLang);const dir=dirOf(lang);const isRTL=dir==="rtl";useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=dir;try{localStorage.setItem(STORAGE_KEY,lang);}catch{}},[lang,dir]);const setLang=useCallback((next:Lang)=>setLangState(next),[]);const toggleLang=useCallback(()=>setLangState(p=>p==="ar"?"fr":"ar"),[]);const t=useCallback((key:string,vars?:Record<string,string|number>)=>{let text=DICTS[lang][key]??DICTS.ar[key]??key;if(vars)for(const[name,value]of Object.entries(vars))text=text.split("{"+name+"}").join(String(value));return text;},[lang]);const catLabel=useCallback((v:string)=>CAT[lang][v]??CAT.ar[v]??v,[lang]);const svcLabel=useCallback((v:string)=>SVC[lang][v]??SVC.ar[v]??v,[lang]);const docLabel=useCallback((v:string)=>DOC[lang][v]??DOC.ar[v]??v,[lang]);const value=useMemo<LanguageContextValue>(()=>({lang,dir,isRTL,setLang,toggleLang,t,catLabel,svcLabel,docLabel}),[lang,dir,isRTL,setLang,toggleLang,t,catLabel,svcLabel,docLabel]);return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;}
export function useLanguage():LanguageContextValue{const ctx=useContext(LanguageContext);if(!ctx)throw new Error("useLanguage must be used within <LanguageProvider>");return ctx;}
