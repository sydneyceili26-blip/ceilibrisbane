import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Category from "./pages/Category.tsx";
import ListingDetail from "./pages/ListingDetail.tsx";
import PostListing from "./pages/PostListing.tsx";
import Community from "./pages/Community.tsx";
import QuestionDetail from "./pages/QuestionDetail.tsx";
import AskQuestion from "./pages/AskQuestion.tsx";
import Categories from "./pages/Categories.tsx";
import Search from "./pages/Search.tsx";
import Auth from "./pages/Auth.tsx";
import Favourites from "./pages/Favourites.tsx";
import MyListings from "./pages/MyListings.tsx";
import Guide from "./pages/Guide.tsx";
import MapView from "./pages/MapView.tsx";
import Admin from "./pages/Admin.tsx";
import Messages from "./pages/Messages.tsx";
import Profile from "./pages/Profile.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import Support from "./pages/Support.tsx";
import RequestDetail from "./pages/RequestDetail.tsx";
import EditRequest from "./pages/EditRequest.tsx";
import Regional from "./pages/Regional.tsx";
import PostRegional from "./pages/PostRegional.tsx";
import RegionalPostDetail from "./pages/RegionalPostDetail.tsx";
import EditRegionalPost from "./pages/EditRegionalPost.tsx";
import EditQuestion from "./pages/EditQuestion.tsx";
import About from "./pages/About.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import ScrollToTop from "./components/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePageTracking } from "./hooks/usePageTracking";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useAdMob } from "./hooks/useAdMob";

const RecoveryRedirect = () => {
  const { isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (isPasswordRecovery && location.pathname !== "/auth") {
      navigate("/auth", { replace: true });
    }
  }, [isPasswordRecovery, location.pathname, navigate]);
  return null;
};

const PageTracker = () => { usePageTracking(); return null; };
const PushNotificationSetup = () => { usePushNotifications(); return null; };
const AdMobSetup = () => { useAdMob(); return null; };

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <RecoveryRedirect />
          <PageTracker />
          <PushNotificationSetup />
          <AdMobSetup />
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/search" element={<Search />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/my-posts" element={<MyListings />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/support" element={<Support />} />
            <Route path="/c/:key" element={<Category />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/request/:id" element={<RequestDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/post" element={<PostListing />} />
            <Route path="/edit/:id" element={<PostListing />} />
            <Route path="/edit-request/:id" element={<EditRequest />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/ask" element={<AskQuestion />} />
            <Route path="/community/:id" element={<QuestionDetail />} />
            <Route path="/regional" element={<Regional />} />
            <Route path="/regional/post" element={<PostRegional />} />
            <Route path="/regional/:id" element={<RegionalPostDetail />} />
            <Route path="/edit-regional/:id" element={<EditRegionalPost />} />
            <Route path="/edit-question/:id" element={<EditQuestion />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
