import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Game from "./pages/Game";
import QuizEdit from "./pages/QuizEdit";
import TV from "./pages/TV";
import Login from "./pages/Login";
import Landing from "./pages/Landing";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/tv" element={<TV />} />
        <Route path="/tv/:quizId" element={<TV />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="quiz/:id/edit" element={<QuizEdit />} />
          <Route path="game/:id" element={<Game />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
