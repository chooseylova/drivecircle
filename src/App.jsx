import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Home from './pages/Home';
import CarProfilePage from './pages/CarProfilePage';
import CreateCarPage from './pages/CreateCarPage';
import MyGarage from './pages/MyGarage';
import EventsPage from './pages/EventsPage';
import CreateEventPage from './pages/CreateEventPage';
import EventDetailPage from './pages/EventDetailPage';
import EditCarPage from './pages/EditCarPage';
import ProfilePage from './pages/ProfilePage';
import Leaderboard from './pages/Leaderboard';
import Marketplace from './pages/Marketplace';
import MessagesPage from './pages/MessagesPage';
import UserProfilePage from './pages/UserProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import PostPage from './pages/PostPage';
import GiveawaysPage from './pages/GiveawaysPage';
import LiveMapPage from './pages/LiveMapPage';
import { LiveShareProvider } from '@/lib/LiveShareContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/car/:carId" element={<CarProfilePage />} />
        <Route path="/create-car" element={<CreateCarPage />} />
        <Route path="/garage" element={<MyGarage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/create-event" element={<CreateEventPage />} />
        <Route path="/event/:eventId" element={<EventDetailPage />} />
        <Route path="/edit-car/:carId" element={<EditCarPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/user/:email" element={<UserProfilePage />} />
        <Route path="/post/:postId" element={<PostPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/giveaways" element={<GiveawaysPage />} />
        <Route path="/live" element={<LiveMapPage />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LiveShareProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
        </LiveShareProvider>
        <Toaster />
        {/* All pages use `toast` from "sonner", so its Toaster must be mounted for messages to appear */}
        <SonnerToaster theme="dark" position="top-center" richColors closeButton />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
