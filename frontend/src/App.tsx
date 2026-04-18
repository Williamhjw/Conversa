import { useAuth } from "./hooks/use-auth";
import { RouterProvider } from "react-router-dom";
import { Loader } from "lucide-react";
import { router } from "./router";

export function App() {
  const { isUserLoading } = useAuth();

  if (isUserLoading) {
    return (
      <div className="flex gap-2 min-h-dvh items-center justify-center p-6">
        <p className="text-lg">Please wait while we authenticate you</p>
        <Loader className="animate-spin" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
