import { useEffect, type ReactNode } from "react";
import { Loader2, LogOut } from "lucide-react";
import { LanguageProvider, useLanguage } from "./i18n";
import { AuthProvider, useAuth } from "./auth";
import { BookingsProvider, ToastProvider, ToastViewport } from "./context";
import { Router, matchPath, useRouter } from "./router";
import { Header, MobileNav } from "./components/navigation";
import { Logo } from "./components/atoms";
import AdminCommandPalette from "./components/AdminCommandPalette";
import AdminV2 from "./pages/AdminV2";
import AdminModeration from "./pages/AdminModeration";
import AdminLogin from "./pages/AdminLogin";
import ProviderMode from "./pages/ProviderMode";
import Home from "./pages/Home";
import Bookings from "./pages/Bookings";
import ProviderDetail from "./pages/ProviderDetail";
import BookingFlow from "./pages/BookingFlow";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Account from "./pages/Account";
import Discover from "./pages/Discover";
import Chat from "./pages/Chat";
import { NotificationProvider } from "./components/notifications/NotificationProvider";
function AppSplash() { const { t } = useLanguage(); return <div className="maak-splash" aria-label={t("common.loading")}><Logo variant="lockup"/><Loader2 className="spin" size={22}/></div>; }
function CustomerShell() { const { path } = useRouter(); const bookingParams=matchPath("/provider/:id/booking",path); const providerParams=bookingParams?null:matchPath("/provider/:id",path); const chatParams=matchPath("/chat/:conversationId",path); let content:ReactNode; if(path==="/login")content=<Login/>; else if(path==="/register")content=<Register/>; else if(path==="/forgot-password")content=<ForgotPassword/>; else if(path==="/reset-password")content=<ResetPassword/>; else if(bookingParams)content=<BookingFlow id={Number(bookingParams.id)}/>; else if(providerParams)content=<ProviderDetail id={Number(providerParams.id)}/>; else if(path==="/bookings")content=<Bookings/>; else if(path==="/onboarding")content=<Onboarding/>; else if(path==="/account")content=<Account/>; else if(path==="/discover")content=<Discover/>; else if(path==="/chat")content=<Chat/>; else if(chatParams)content=<Chat conversationId={chatParams.conversationId}/>; else content=<Home/>; const isProviderScreen=path.startsWith("/provider"); const isAuthScreen=path==="/login"||path==="/register"||path==="/forgot-password"||path==="/reset-password"; return <div className="app"><div className="shell">{!isAuthScreen&&<Header path={path}/>}<main className="app-main" key={path}>{content}</main></div>{!isAuthScreen&&!isProviderScreen&&<MobileNav path={path}/>}<ToastViewport/></div>; }
function AdminGate(){const{path,navigate}=useRouter();const{user,loading,profile,profileLoading}=useAuth();const isLoginPage=path==="/admin/login";const ready=!loading&&!profileLoading;const isAdmin=ready&&!!user&&profile?.role==="admin"&&profile?.account_status!=="suspended";useEffect(()=>{if(!ready)return;if(isLoginPage){if(isAdmin)navigate("/admin");}else if(!isAdmin)navigate("/admin/login");},[ready,isAdmin,isLoginPage,navigate]);if(loading)return <AppSplash/>;if(isLoginPage)return ready&&isAdmin?<AppSplash/>:<AdminLogin/>;if(!isAdmin)return <AppSplash/>;return <AdminModeration/>;}
function AdminLogoutControl(){const{path,navigate}=useRouter();const{signOut}=useAuth();if(!path.startsWith("/admin")||path==="/admin/login")return null;async function handleSignOut(){await signOut();navigate("/admin/login");}return <button className="m2-icon-btn" type="button" onClick={()=>void handleSignOut()} aria-label="Sign out" title="Sign out" style={{position:"fixed",right:20,bottom:20,zIndex:120}}><LogOut size={18}/></button>;}
function AdminSurface(){return <ToastProvider><AdminGate/><AdminLogoutControl/><AdminCommandPalette/><ToastViewport/></ToastProvider>;}
function RoleShell(){const{path,navigate}=useRouter();const{role,loading,profileLoading,user}=useAuth();const authReady=!loading&&!profileLoading;const wantsProviderMode=path==="/provider-mode";useEffect(()=>{if(role==="admin"&&!path.startsWith("/admin"))navigate("/admin");},[role,path,navigate]);useEffect(()=>{if(!wantsProviderMode||!authReady)return;if(role!=="provider")navigate(user?"/account":"/login");},[wantsProviderMode,authReady,role,user,navigate]);if(path.startsWith("/admin"))return <AdminSurface/>;if(wantsProviderMode&&(!authReady||role!=="provider"))return <AppSplash/>;if(role==="provider"&&wantsProviderMode)return <ToastProvider><div className="app provider-app"><ProviderMode switchRole={()=>navigate("/")}/><ToastViewport/></div></ToastProvider>;if(role==="admin")return <AppSplash/>;return <ToastProvider><BookingsProvider><CustomerShell/></BookingsProvider></ToastProvider>;}
export default function App(){return <LanguageProvider><AuthProvider><Router><NotificationProvider><RoleShell/></NotificationProvider></Router></AuthProvider></LanguageProvider>;}
