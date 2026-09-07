import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { LanguageProvider, useLanguage } from "./i18n";
import { AuthProvider, useAuth } from "./auth";
import { BookingsProvider, ToastProvider, ToastViewport } from "./context";
import { Router, matchPath, useRouter } from "./router";
import { Header, MobileNav } from "./components/navigation";
import { Logo } from "./components/atoms";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import ProviderMode from "./pages/ProviderMode";
import Home from "./pages/Home";
import Bookings from "./pages/Bookings";
import Chat from "./pages/Chat";
import ProviderDetail from "./pages/ProviderDetail";
import BookingFlow from "./pages/BookingFlow";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Account from "./pages/Account";
import Discover from "./pages/Discover";
function AppSplash(){const {t}=useLanguage();return <div className="maak-splash" aria-label={t("common.loading")}><Logo variant="lockup"/><Loader2 className="spin" size={22}/></div>}
function CustomerShell(){const{path}=useRouter();const bookingParams=matchPath("/provider/:id/booking",path);const providerParams=bookingParams?null:matchPath("/provider/:id",path);const chatProviderParams=matchPath("/chat/provider/:providerId",path);let content:ReactNode;if(path==="/login")content=<Login/>;else if(path==="/register")content=<Register/>;else if(path==="/forgot-password")content=<ForgotPassword/>;else if(path==="/reset-password")content=<ResetPassword/>;else if(bookingParams)content=<BookingFlow id={Number(bookingParams.id)}/>;else if(providerParams)content=<ProviderDetail id={Number(providerParams.id)}/>;else if(chatProviderParams)content=<Chat providerId={chatProviderParams.providerId}/>;else if(path==="/bookings")content=<Bookings/>;else if(path==="/chat")content=<Chat/>;else if(path==="/onboarding")content=<Onboarding/>;else if(path==="/account")content=<Account/>;else if(path==="/discover")content=<Discover/>;else content=<Home/>;const isProviderScreen=path.startsWith("/provider");const isAuthScreen=path==="/login"||path==="/register"||path==="/forgot-password"||path==="/reset-password";return <div className="app"><div className="shell">{!isAuthScreen&&<Header path={path}/>}<main className="app-main" key={path}>{content}</main></div>{!isAuthScreen&&!isProviderScreen&&<MobileNav path={path}/>}<ToastViewport/></div>}
function AdminGate(){const{path,navigate}=useRouter();const{user,loading,profile,profileLoading,signOut}=useAuth();const isLoginPage=path==="/admin/login";const ready=!loading&&!profileLoading;const isAdmin=ready&&!!user&&profile?.role==="admin";useEffect(()=>{if(!ready)return;if(isLoginPage){if(isAdmin)navigate("/admin")}else if(!isAdmin)navigate("/admin/login")},[ready,isAdmin,isLoginPage,navigate]);if(loading)return <AppSplash/>;if(isLoginPage)return ready&&isAdmin?<AppSplash/>:<AdminLogin/>;if(!isAdmin)return <AppSplash/>;return <Admin switchRole={()=>void signOut()}/>}
function AdminSurface(){return <ToastProvider><AdminGate/><ToastViewport/></ToastProvider>}
function RoleShell(){const{path,navigate}=useRouter();const{role,loading,profileLoading,user}=useAuth();const exit=()=>navigate("/account");const authReady=!loading&&!profileLoading;useEffect(()=>{if(role==="admin"&&!path.startsWith("/admin"))navigate("/admin")},[role,path,navigate]);const wantsProviderMode=path==="/provider-mode";useEffect(()=>{if(!wantsProviderMode||!authReady)return;if(role!=="provider")navigate(user?"/account":"/login")},[wantsProviderMode,authReady,role,user,navigate]);if(path.startsWith("/admin"))return <AdminSurface/>;if(wantsProviderMode&&(!authReady||role!=="provider"))return <AppSplash/>;if(role==="provider")return <ToastProvider><div className="app provider-app"><ProviderMode switchRole={exit}/><ToastViewport/></div></ToastProvider>;if(role==="admin")return <AppSplash/>;return <ToastProvider><BookingsProvider><CustomerShell/></BookingsProvider></ToastProvider>}
export default function App(){return <LanguageProvider><AuthProvider><Router><RoleShell/></Router></AuthProvider></LanguageProvider>}
