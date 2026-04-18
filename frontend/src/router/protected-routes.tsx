import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Loader2 } from "lucide-react";

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="size-6 animate-spin text-primary" />
  </div>
);

const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const ConversationLayout = lazy(() => import("@/components/layout/ConversationLayout"));

const User = lazy(() => import("@/pages/User"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const StarredMessages = lazy(() => import("@/pages/StarredMessages"));
const Weather = lazy(() => import("@/pages/Weather"));
const Stock = lazy(() => import("@/pages/Stock"));
const Games = lazy(() => import("@/pages/Games"));
const SnakeGame = lazy(() => import("@/pages/SnakeGame"));
const LeetCode = lazy(() => import("@/pages/LeetCode"));
const Conversations = lazy(() => import("@/pages/Conversations"));
const ConversationDetail = lazy(() => import("@/pages/ConversationDetail"));

const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const protectedRoutes: RouteObject[] = [
  {
    element: withSuspense(DashboardLayout),
    children: [
      { path: "/user", element: withSuspense(User) },
      { path: "/user/profile", element: withSuspense(UserProfile) },
      { path: "/user/starred", element: withSuspense(StarredMessages) },
      { path: "/user/weather", element: withSuspense(Weather) },
      { path: "/user/stock", element: withSuspense(Stock) },
      { path: "/user/games", element: withSuspense(Games) },
      { path: "/user/games/snake", element: withSuspense(SnakeGame) },
      { path: "/user/games/leetcode", element: withSuspense(LeetCode) },
      {
        element: withSuspense(ConversationLayout),
        children: [
          { path: "/user/conversations", element: withSuspense(Conversations) },
          { path: "/user/conversations/:id", element: withSuspense(ConversationDetail) },
        ],
      },
    ],
  },
];
